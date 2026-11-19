// Testler için: React Native, Expo ve Firebase modülleri Node'da yüklenemez. Çiftlik ve date planı mantığı saf işlevlerdir;
// bu modüllerin yerine her özelliği boş işlev dönen bir vekil konur.
const Module = require('module');
const path = require('path');
const stub = path.join(__dirname, 'stub.cjs');
const real = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (/^(firebase|react-native|expo|@react-native|@expo|react$)/.test(request) || /(^|\/)firebase$/.test(request) || /\.(webp|png|jpg|wav)$/.test(request))
    return stub;
  return real.call(this, request, parent, ...rest);
};
