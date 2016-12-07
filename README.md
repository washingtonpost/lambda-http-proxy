# Lambda HTTP Proxy
This module is used to standardize the http to lambda mapping and function invocation.

## Usage
```
var lambda_http_proxy = require('lambda_http_proxy');
app.all('/api', lambda_http_proxy.invoke);
```

The following headers are supported/required:
* x-FunctionName, Required, Lambda function name.
* x-LogType, Optional, None or Tail.
* x-Qualifier, Optional

See the Lambda function params here for more information:  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property

The response structure looks like:
```
{
    StatusCode: data.StatusCode,
    FunctionError: data.FunctionError,
    LogResult: data.LogResult,
    Payload: !_.isNil(data.Payload) ? JSON.parse(data.Payload) : null
}
```

This module requires express.js