"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.promisify = promisify;
// Returns a wrapper function that will promisify a given callback function.
// It will preserve 'this'.
function promisify(fn) {
  return function () {
    // If the last argument is a function, assume its the callback.
    let callback = arguments[arguments.length - 1];

    // If the callback is given, don't promisify, just pass straight in.
    if (typeof callback === 'function') {
      return fn.apply(this, arguments);
    }

    // Otherwise, create a new set of arguments, and wrap
    // it in a promise.
    let args = [...arguments];
    return new Promise((resolve, reject) => {
      // Add the callback function.
      args.push((err, value) => {
        if (err) {
          return reject(err);
        }
        resolve(value);
      });

      // Call the function with our special adaptor callback added.
      fn.apply(this, args);
    });
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJwcm9taXNpZnkiLCJmbiIsImNhbGxiYWNrIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiYXBwbHkiLCJhcmdzIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJwdXNoIiwiZXJyIiwidmFsdWUiXSwic291cmNlcyI6WyJwcm9taXNpZnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gUmV0dXJucyBhIHdyYXBwZXIgZnVuY3Rpb24gdGhhdCB3aWxsIHByb21pc2lmeSBhIGdpdmVuIGNhbGxiYWNrIGZ1bmN0aW9uLlxuLy8gSXQgd2lsbCBwcmVzZXJ2ZSAndGhpcycuXG5leHBvcnQgZnVuY3Rpb24gcHJvbWlzaWZ5KGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgLy8gSWYgdGhlIGxhc3QgYXJndW1lbnQgaXMgYSBmdW5jdGlvbiwgYXNzdW1lIGl0cyB0aGUgY2FsbGJhY2suXG4gICAgbGV0IGNhbGxiYWNrID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXVxuXG4gICAgLy8gSWYgdGhlIGNhbGxiYWNrIGlzIGdpdmVuLCBkb24ndCBwcm9taXNpZnksIGp1c3QgcGFzcyBzdHJhaWdodCBpbi5cbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSwgY3JlYXRlIGEgbmV3IHNldCBvZiBhcmd1bWVudHMsIGFuZCB3cmFwXG4gICAgLy8gaXQgaW4gYSBwcm9taXNlLlxuICAgIGxldCBhcmdzID0gWy4uLmFyZ3VtZW50c11cblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAvLyBBZGQgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAgYXJncy5wdXNoKChlcnIsIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycilcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc29sdmUodmFsdWUpXG4gICAgICB9KVxuXG4gICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB3aXRoIG91ciBzcGVjaWFsIGFkYXB0b3IgY2FsbGJhY2sgYWRkZWQuXG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmdzKVxuICAgIH0pXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFDQTtBQUNPLFNBQVNBLFNBQVNBLENBQUNDLEVBQUUsRUFBRTtFQUM1QixPQUFPLFlBQVk7SUFDakI7SUFDQSxJQUFJQyxRQUFRLEdBQUdDLFNBQVMsQ0FBQ0EsU0FBUyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDOztJQUU5QztJQUNBLElBQUksT0FBT0YsUUFBUSxLQUFLLFVBQVUsRUFBRTtNQUNsQyxPQUFPRCxFQUFFLENBQUNJLEtBQUssQ0FBQyxJQUFJLEVBQUVGLFNBQVMsQ0FBQztJQUNsQzs7SUFFQTtJQUNBO0lBQ0EsSUFBSUcsSUFBSSxHQUFHLENBQUMsR0FBR0gsU0FBUyxDQUFDO0lBRXpCLE9BQU8sSUFBSUksT0FBTyxDQUFDLENBQUNDLE9BQU8sRUFBRUMsTUFBTSxLQUFLO01BQ3RDO01BQ0FILElBQUksQ0FBQ0ksSUFBSSxDQUFDLENBQUNDLEdBQUcsRUFBRUMsS0FBSyxLQUFLO1FBQ3hCLElBQUlELEdBQUcsRUFBRTtVQUNQLE9BQU9GLE1BQU0sQ0FBQ0UsR0FBRyxDQUFDO1FBQ3BCO1FBRUFILE9BQU8sQ0FBQ0ksS0FBSyxDQUFDO01BQ2hCLENBQUMsQ0FBQzs7TUFFRjtNQUNBWCxFQUFFLENBQUNJLEtBQUssQ0FBQyxJQUFJLEVBQUVDLElBQUksQ0FBQztJQUN0QixDQUFDLENBQUM7RUFDSixDQUFDO0FBQ0gifQ==