/**
 * Example beforeRequest transformation
 * Adds an authorization header to all requests
 */

function transform(request) {
  // Add or modify headers
  request.headers['x-api-key'] = 'demo-api-key-12345';
  request.headers['x-custom-header'] = 'Added by transformation';
  
  console.log(`🔧 Transformation: Added auth headers to ${request.url}`);
  
  return request;
}

// Export the transform function
this.transform = transform;

