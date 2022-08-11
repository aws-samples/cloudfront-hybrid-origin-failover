exports.handler = async function(event) {
    console.log("request:", JSON.stringify(event, undefined, 2));
    return {
      statusCode: process.env.statusCodeVariable,
      headers: { "Content-Type": "text/plain" },
      body: `Hello! You've hit the ${process.env.failoverVariable} Origin in ${process.env.region}\n`
    };
  };