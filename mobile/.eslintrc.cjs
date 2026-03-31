module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['.expo/**', 'dist/**', 'build/**'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
  },
};
