module.exports = {
  requestWhitelist: ['url', 'headers', 'method', 'body', 'query'],
  responseWhitelist: ['_headers', 'statusCode', 'body', 'responseTime'],
  headerBlacklist: [
    'connection',
    'user-agent',
    'postman-token',
    'accept-encoding',
    'content-length',
    'host',
    'x-request-id',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-proto',
    'x-forwarded-scheme',
    'x-scheme',
    'if-none-match'
  ],
  deleteFromReq: [
    'transitional',
    'transformRequest',
    'transformResponse',
    'xsrfCookieName',
    'xsrfHeaderName',
    'env',
    'maxContentLength',
    'maxBodyLength',
    'time'
  ],
  deleteHeadersKeys : ['common', 'get', 'put', 'post', 'delete', 'head', 'patch']
};
