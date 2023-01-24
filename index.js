const { MongoClient } = require('mongodb');
const expressWinston = require('express-winston');
const winston = require('winston');
const _ = require('lodash');
const axios = require('axios');
const WinstonMongodb = require('winston-mongodb').MongoDB;
const logger = require('./helpers/logger');
const constant = require('./constant');

WinstonMongodb.prototype.log = logger;

module.exports = function (db, option, label, appName) {
  return {
    connect: async (clientDB) => {
      if (clientDB) {
        if(!clientDB.readyState) throw 'Provided client is not active';
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
    axiosLogger: async function (
      collectionName = 'out',
      expireAfterSeconds = 41472000,
      deleteFromReq,
      deleteHeadersKeys
    ) {
      if (!deleteFromReq) {
        deleteFromReq = constant.deleteFromReq;
      }

      if (!deleteHeadersKeys) {
        deleteHeadersKeys = constant.deleteHeadersKeys;
      }
      const axiosLog = await db
        .createCollection(collectionName)
        .then(async (col) => {
          await col.createIndex({ 'time.startTime': 1 }, { background: true, expireAfterSeconds });
          return col;
        })
        .catch(async (err) => {
          if (err.code !== 48) throw err;
          const ttlIndexName = 'time.startTime_1';
          const col = db.collection(collectionName);
          const prevTtlInfo = (await col.indexes()).find((e) => e.name === ttlIndexName);
          if (!prevTtlInfo || prevTtlInfo.expireAfterSeconds != expireAfterSeconds) {
            prevTtlInfo && (await col.dropIndex(ttlIndexName));
            await col.createIndex(
              { 'time.startTime': 1 },
              { background: true, expireAfterSeconds }
            );
          }
          return col;
        });
      axios.interceptors.request.use(
        async function (req) {
          req.time = {
            startTime: new Date(),
            utcDate: new Date(new Date().setUTCHours(0, 0, 0, 0))
          };
          const saveReq = _.omit(req, deleteFromReq);
          saveReq.headers = _.omit(req.headers, deleteHeadersKeys);

          const inserted = await axiosLog.insertOne({ req: saveReq, time: req.time, label });
          if (inserted.acknowledged) {
            req.logId = inserted.insertedId;
          }
          return req;
        },
        (err) => {
          return Promise.reject(err);
        }
      );

      function saveResponse(res) {
        const endTime = new Date();
        if (res.config.logId) {
          const toUpdate = {
            status: res.status,
            statusText: res.statusText,
            data: res.data,
            headers: res.headers
          };
          axiosLog
            .updateOne(
              { _id: res.config.logId },
              {
                $set: {
                  res: toUpdate,
                  'time.endTime': endTime,
                  'time.duration': endTime - res.config.time.startTime
                }
              }
            )
            .catch(console.error);
        }
      }

      axios.interceptors.response.use(
        async function (res) {
          saveResponse(res);
          return res;
        },
        (err) => {
          saveResponse({ config: err.config, ...err.response });
          return Promise.reject(err);
        }
      );
    }
  };
};
