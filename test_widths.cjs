const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace('table {', 'table {\n            table-layout: fixed;');

html = html.replace('        th {', `        th:nth-child(1) { width: 8%; }
        th:nth-child(2) { width: 25%; }
        th:nth-child(3) { width: 55%; }
        th:nth-child(4) { width: 12%; text-align: right; }

        th {`);

fs.writeFileSync('index.html', html);
