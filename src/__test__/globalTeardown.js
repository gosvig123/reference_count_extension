module.exports = async () => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait for any pending operations
};
