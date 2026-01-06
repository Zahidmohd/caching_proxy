/**
 * Example afterResponse transformation
 * Removes sensitive data from responses
 */

function transform(response) {
  // Parse JSON body if it's JSON
  const contentType = response.headers['content-type'] || '';
  
  if (contentType.includes('application/json') && response.body) {
    try {
      const data = JSON.parse(response.body);
      
      // Remove sensitive fields
      if (data.password) {
        delete data.password;
        console.log(`🔧 Transformation: Removed 'password' field`);
      }
      
      if (data.ssn) {
        delete data.ssn;
        console.log(`🔧 Transformation: Removed 'ssn' field`);
      }
      
      // Add transformation marker
      data._transformed = true;
      
      // Convert back to JSON
      response.body = JSON.stringify(data);
    } catch (error) {
      console.log(`⚠️  Could not parse JSON for transformation: ${error.message}`);
    }
  }
  
  return response;
}

// Export the transform function
this.transform = transform;

