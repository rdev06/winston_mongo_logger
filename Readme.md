```js
const mongoLogger = require('winston_mongo_logger');
const mongoLogUri = process.env.MONGO_URL;

const mongodbOptions = {
  dbName: 'LOG',
  user: process.env.MONGO_USER,
  pass: process.env.MONGO_PASS
};

const logger = mongoLogger(mongoLogUri, mongodbOptions, '<label>', 'appName'); // mongoUri is an optional in case you want to create an another instance of database

const useDb = require('./instanse-of-db');


async function main() {
  const db = await useDb;
  console.log('mongodb connected');
  await env.appConfig();
  await logger.connect(db); // use parent instance of mongodb just to save mongo pool
  console.log('Mongo Logger Connected');
  await logger.axiosLogger('out_appName', 172800);
  console.log('axios logger used');
  await logger.traceLogger('trace_appName');
  console.log('Trace logger used')
  const app = require('./app');
  app.listen(3001);
  return true; 
}

main()
  .then(() => console.log('Server is running at http://localhost:3001'))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```


## If you want to capture some data at any specific place then
```js

logger.customEvent('some_event_name', {foo: 'bar'}, 'info') // third argument is level which can be any of these [info, warn, error]

```

## If you want capture logs of streaming data (i.e res.write('some data') then do as below)

```js
router.use(logger.captureStreaming(), session) // session is express-session midleware

```