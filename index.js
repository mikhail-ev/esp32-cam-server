const http = require('http');
const fs = require('fs');
const rxjs = require('rxjs');
const operators = require('rxjs/operators');

function log(...args) {
    console.log(`[${new Date().toLocaleTimeString()}]:`, ...args)
}

const BOUNDARY = 'FRAME-BOUNDARY-123';
const BOUNDARY_BUFFER = Buffer.from(BOUNDARY);
const BOUNDARY_LENGTH = BOUNDARY_BUFFER.length

const DEFAULT = fs.readFileSync('./placeholder.jpg')

const subject = new rxjs.BehaviorSubject(DEFAULT);

http.createServer(function(req, res) {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=myboundary',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });
    // For some reason mjpeg needs to be sent twice initially in order to display first frame
    const subscription = rxjs.concat(subject.pipe(operators.first()), subject).subscribe((buffer) => {
        res.write("--myboundary\r\n");
        res.write("Content-Type: image/jpeg\r\n");
        res.write("Content-Length: " + buffer.length + "\r\n");
        res.write("\r\n");
        res.write(buffer, 'binary');
        res.write("\r\n");
    })
    req.on("close", function() {
        subscription.unsubscribe();
        res.end();
    });

    req.on("end", function() {
        subscription.unsubscribe();
        res.end();
    });
}).listen(8081);

http.createServer((request) => {
    let body = [];
    request.on('error', (err) => {
        log('error;', err);
    }).on('data', (chunk) => {
        log('Got frame')
        const boundaryIndex = chunk.indexOf(BOUNDARY_BUFFER)
        const includesBoundary = boundaryIndex !== -1;
        if (includesBoundary) {
            const lastPart = chunk.slice(0, boundaryIndex);

            if (lastPart.length) {
                body.push(lastPart);
            }

            subject.next(Buffer.concat(body))
            body = [];

            const nextPart = chunk.slice(boundaryIndex + BOUNDARY_LENGTH)

            if (nextPart.length) {
                body.push(nextPart)
            }
        } else {
            body.push(chunk)
        }
    });
}).listen(8080);
