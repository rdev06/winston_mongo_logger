const _ = require('lodash');
const constant = require('../constant');

module.exports = async function (
    collectionName = 'out',
    expireAfterSeconds = 41472000,
    deleteFromReq,
    deleteHeadersKeys,
    axios
  ) {
    const label = this.label;
    if (!deleteFromReq) {
      deleteFromReq = constant.deleteFromReq;
    }

    if (!deleteHeadersKeys) {
      deleteHeadersKeys = constant.deleteHeadersKeys;
    }
    if(!axios){
      axios = require('axios');
    }
    const axiosLog = await this.db
      .createCollection(collectionName)
      .then(async (col) => {
        await col.createIndex({ 'time.startTime': 1 }, { background: true, expireAfterSeconds });
        return col;
      })
      .catch(async (err) => {
        if (err.code !== 48) throw err;
        const ttlIndexName = 'time.startTime_1';
        const col = this.db.collection(collectionName);
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
        
        if(saveReq.data.constructor.name === 'FormData'){
          saveReq.data = 'FormData'
        }

        const inserted = await axiosLog.insertOne({ req: saveReq, time: req.time, label });
        if (!!inserted.insertedId) {
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
      if (res.config?.logId) {
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