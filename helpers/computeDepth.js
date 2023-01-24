module.exports = function computeDepth(path) {
  const startIndex = path.indexOf('/');
  const queryIndex = path.indexOf('?');
  const endsIndex = queryIndex !== -1 ? queryIndex : path.length;
  const depth = path.slice(startIndex, endsIndex).split('/').filter(String);
  return depth.join('_');
};
