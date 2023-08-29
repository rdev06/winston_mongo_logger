const { MongoClient } = require('mongodb');
const expressWinston = require('express-winston');
const winston = require('winston');
const WinstonMongodb = require('winston-mongodb').MongoDB;
const logger = require('./helpers/logger');
const constant = require('./constant');
const axiosLogIntercept = require('./helpers/axiosLogIntercept');

WinstonMongodb.prototype.log = logger;

module.exports = function (db, option, label, appName) {
  return {
    connect: async (clientDB) => {
      if (clientDB) {
        if (!clientDB.readyState) throw 'Provided client is not active';
        if (clientDB.useDb) db = clientDB.useDb(option.dbName);
        else if (clientDB.db) db = clientDB.db(option.dbName);
        else throw 'clientDB is not recognised';
        return true;
      }
      if (typeof db === 'string') {
        const parseUri = new URL(db);
        if (option.user) parseUri.username = option.user;
        if (option.pass) parseUri.password = option.pass;
        parseUri.pathname = option.dbName;
        db = parseUri.href;
        const client = new MongoClient(parseUri.href, {
          useUnifiedTopology: true
        });
        await client.connect();
        db = client.db(parseUri.pathname.slice(1));
        return true;
      }
      throw 'not connected';
    },
    mongoTransport: (collection, expireAfterSeconds = 0) => {
      return new winston.transports.MongoDB({
        db,
        label,
        collection: `${collection}${appName ? '_' + appName : ''}`,
        metaKey: 'meta',
        handleExceptions: true,
        expireAfterSeconds
      });
    },
    routerLogger: function (requestWhitelist, expireAfterSeconds = 41472000) {
      return expressWinston.logger({
        transports: [this.mongoTransport('route', expireAfterSeconds)],
        format: winston.format.json(),
        statusLevels: true,
        msg: '{{req.method}} {{req.url}}',
        requestWhitelist: [...requestWhitelist, ...constant.requestWhitelist],
        responseWhitelist: constant.responseWhitelist,
        headerBlacklist: constant.headerBlacklist
      });
    },
    errorLogger: function () {
      return expressWinston.errorLogger({
        transports: [this.mongoTransport('error')],
        format: winston.format.json(),
        dumpExceptions: true,
        showStack: true
      });
    },
    customEvent: function (eventName, data, level = 'info') {
      const logger = winston.createLogger({
        transports: [this.mongoTransport('customEvents')],
        format: winston.format.json()
      });
      return logger.log(level, eventName, { meta: data });
    },
    axiosLogger: (...args) => axiosLogIntercept.call({db, label}, ...args),
    traceLogger: async (collectionName = 'trace', expireAfterSeconds = 41472000) => {
      const originalStdoutWrite = process.stdout.write.bind(process.stdout);
      const traceDB = await db
        .createCollection(collectionName)
        .then(async (col) => {
          await col.createIndex({ timestamp: 1 }, { background: true, expireAfterSeconds });
          return col;
        })
        .catch(async (err) => {
          if (err.code !== 48) throw err;
          const ttlIndexName = 'timestamp_1';
          const col = db.collection(collectionName);
          const prevTtlInfo = (await col.indexes()).find((e) => e.name === ttlIndexName);
          if (!prevTtlInfo || prevTtlInfo.expireAfterSeconds != expireAfterSeconds) {
            prevTtlInfo && (await col.dropIndex(ttlIndexName));
            await col.createIndex({ timestamp: 1 }, { background: true, expireAfterSeconds });
          }
          return col;
        });
      process.stdout.write = async (chunk, encoding, callback) => {
        await traceDB
          .insertOne({
            chunk: chunk.trim(),
            timestamp: new Date(),
            utcDate: new Date(new Date().setUTCHours(0, 0, 0, 0))
          })
          .catch(console.error);

        return originalStdoutWrite(chunk, encoding, callback);
      };
    },
    captureStreaming: () => {
      process.env.IS_LOCAL === 'true' && console.warn('winston_mongo_logger/captureStreaming: Use this only in place where you dont want streaming');
      return (req, res, next) => {
        let _chunk = '';
        res.write = function (chunk) {
          if(chunk) _chunk += chunk;
        };
        const end = res.end;
        res.end = function (chunk, encoding) {
          if(!chunk) _chunk = chunk;
          else _chunk += chunk;
          end.call(res, _chunk, encoding);
        };
        return next();
      }
    }
  };
};
