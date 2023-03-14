function isArrayLikeObject(body){
    if(typeof body !== 'object') return false;
    const objectKeys = Object.keys(body);
    for (let i = 0; i < objectKeys.length; i++) {
        if(i != objectKeys[i]) return false;
    }
    return true
  }
  
  
  module.exports = function formatResponseBody(body){
    return isArrayLikeObject(body) ? Object.keys(body) : body
  };
  