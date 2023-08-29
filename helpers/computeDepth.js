module.exports = function computeDepth(path) {
  const startIndex = path.indexOf('/');
  if(startIndex < 0) return path;
  const queryIndex = path.indexOf('?');
  const endsIndex = queryIndex !== -1 ? queryIndex : path.length;
  const depth = path.slice(startIndex, endsIndex).split('/').filter(String);
  return depth.join('_');
};
