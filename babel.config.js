module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Keep worklets plugin last. Harmless when Reanimated is unused; required if it is.
    plugins: ["react-native-worklets/plugin"],
  };
};
