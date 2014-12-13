const _ = require('lodash-next');
const superagent = require('superagent');

const DEFAULT_TIMEOUT = 10000;

function promisify(req) {
  return new Promise((resolve, reject) => req.end((err, res) => {
    if(err) {
      return reject(err);
    }
    if(res.error) {
      return reject(res.error);
    }
    resolve(res.body);
  }));
}

/**
 * Promise-based wrapper with avoid running the same request twice concurrently.
 * Also allows to abort/timeout fluently.
 */
class Requester {
  constructor({ requestTimeout }) {
    this.requestTimeout = requestTimeout || DEFAULT_TIMEOUT;
    _.dev(() => this.requestTimeout.should.be.a.Number.and.not.be.below(0));
    this.cache = {};
  }

  // Public methods

  destroy() {
    // Will implicitly call delete this.cache[url]
    Object.keys(this.cache).forEach((url) => this.cache[url].cancel(new Error('Requester destroyed')));
    this.cache = null;
  }

  get(url) {
    _.dev(() => url.should.be.a.String);
    if(!this.cache[url]) {
      this.cache[url] = this._createRequest(superagent.get(url).accept('application/json'))
      .finally(() => {
        delete this.cache[url];
      });
    }
    return this.cache[url];
  }

  abort(url) {
    _.dev(() => url.should.be.a.String);
    if(this.cache[url]) {
      this.cache[url].cancel(new Error('Aborted'));
    }
  }

  post(url, params) {
    params = params || {};
    _.dev(() => url.should.be.a.String && params.should.be.an.Object);
    return this._createRequest(superagent.post(url).type('json').send(params));
  }

  // Private methods

  _createRequest(req) {
    return promisify(req)
    .cancellable()
    .timeout(this.requestTimeout)
    .catch(Promise.TimeoutError, Promise.CancellationError, (err) => {
      // Abort the request and rethrow
      req.abort();
      throw err;
    });
  }
}

_.extend(Requester.prototype, {
  requestTimeout: null,
  cache: null,
});

module.exports = Requester;
