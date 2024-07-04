'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Determines the resolved dependency path according to
 * the Sass compiler's dependency lookup behavior
 *
 * @param  {Object} options
 * @param  {String} options.dependency - the import name
 * @param  {String} options.filename - the file containing the import
 * @param  {String|Array<String>} options.directory - the location(s) of all sass files
 * @return {String}
 */
module.exports = function({ dependency, filename, directory } = {}) {
  if (dependency === undefined) throw new Error('dependency is not supplied');
  if (filename === undefined) throw new Error('filename is not supplied');
  if (directory === undefined) throw new Error('directory is not supplied');

  // Use the file's extension if necessary
  const ext = path.extname(dependency) ? '' : path.extname(filename);

  if (!path.isAbsolute(dependency)) {
    const sassDep = path.resolve(filename, dependency) + ext;

    if (fs.existsSync(sassDep)) {
      return sassDep;
    }
  }

  // `path.basename` in case the dependency is slashed: a/b/c should be a/b/_c.scss
  const isSlashed = dependency.includes('/');
  const depDir = isSlashed ? path.dirname(dependency) : '';
  const depName = (isSlashed ? path.basename(dependency) : dependency) + ext;
  const fileDir = path.dirname(filename);
  const searchDir = path.resolve(fileDir, depDir);

  const relativeToFile = findDependency(searchDir, depName);

  if (relativeToFile) {
    return relativeToFile;
  }

  const directories = Array.isArray(directory) ? directory : [directory];

  for (const dir of Object.values(directories)) {
    const searchDir = path.resolve(dir, depDir);
    const relativeToDir = findDependency(searchDir, depName);

    if (relativeToDir) {
      return relativeToDir;
    }
  }

  // Old versions returned a static path, if one could not be found.
  // Do the same, if `directory` is not an array
  if (typeof directory === 'string') {
    return path.resolve(directory, depDir, depName);
  }
};

function findDependency(searchDir, depName) {
  const nonPartialPath = path.resolve(searchDir, depName);
  if (fs.existsSync(nonPartialPath)) {
    return nonPartialPath;
  }

  const partialsPath = path.resolve(searchDir, `_${depName}`);
  if (fs.existsSync(partialsPath)) {
    return partialsPath;
  }
}
