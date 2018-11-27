var morgan  = require("morgan");

// A vulnerability ( see https://nodesecurity.io/advisories/736 )
// forced an update to morgan 1.9.1, which has non-grey status output ( see https://github.com/expressjs/morgan/commit/bf9cc8051a1332406c73f21df175ca7d2b875ce1 )
// As this makes reading the debugging output much harder, here is simple fix:

module.exports = morgan;
morgan.format('greydev', function developmentFormatLine (tokens, req, res) {
  // get the status code if response written
  var status = res.statusCode || undefined;

  // get status color
  var color = status >= 500 ? 31 // red
    : status >= 400 ? 33 // yellow
      : status >= 300 ? 36 // cyan
        : status >= 200 ? 32 // green
          : 0 // no color

  // get colored function
  var fn = developmentFormatLine[color]

  if (!fn) {
    // compile
    fn = developmentFormatLine[color] = morgan.compile('\x1b[90m:method :url \x1b[' +
      color + 'm:status \x1b[90m:response-time ms - :res[content-length]\x1b[0m')
  }

  return fn(tokens, req, res)
})
