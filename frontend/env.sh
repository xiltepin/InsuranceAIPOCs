#!/bin/sh
cat > /usr/share/nginx/html/env.js << ENVEOF
(function(window) {
  window["env"] = window["env"] || {};
  window["env"]["apiUrl"] = "${BACKEND_URL:-}";
  window["env"]["customersApiUrl"] = "${CUSTOMERS_API_URL:-http://143.189.152.71:3000/CustomersInfo/}";
})(window);
ENVEOF
