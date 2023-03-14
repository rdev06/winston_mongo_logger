const computeDepth = require('./computeDepth');
const util = require('util');
const helpers = require('winston-mongodb/lib/helpers');
const formatResponseBody = require('./formatResponseBody');
module.exports = function (info, cb) {
  if (!this.logDb) {
    this._opQueue.push({ method: 'log', args: arguments });
    return true;
  }
  if (!cb) {
    cb = () => {};
  }
  // Avoid reentrancy that can be not assumed by database code.
  // If database logs, better not to call database itself in the same call.
  process.nextTick(() => {
    if (this.silent) {
      cb(null, true);
    }
    const decolorizeRegex = new RegExp(/\u001b\[[0-9]{1,2}m/g);
    let entry = {
      timestamp: new Date(),
      utcDate: new Date(new Date().setUTCHours(0, 0, 0, 0)),
      level: this.decolorize ? info.level.replace(decolorizeRegex, '') : info.level
    };
    let message = util.format(info.message, ...(info.splat || []));
    entry.message = this.decolorize ? message.replace(decolorizeRegex, '') : message;
    entry.depth = computeDepth(entry.message);
    entry.meta = helpers.prepareMetaData(info[this.metaKey]);
    entry.meta.req.body = formatResponseBody(entry.meta.req.body);
    if (this.storeHost) {
      entry.hostname = this.hostname;
    }
    if (this.label) {
      entry.label = this.label;
    }
    this.logDb
      .collection(this.collection)
      .insertOne(entry)
      .then(() => {
        this.emit('logged');
        cb(null, true);
      })
      .catch((err) => {
        this.emit('error', err);
        cb(err);
      });
  });
  return true;
};
