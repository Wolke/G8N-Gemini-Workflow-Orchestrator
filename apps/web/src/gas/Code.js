/**
 * G8N - GAS Backend Entry Point
 * Handles HTTP requests and routing
 */

/**
 * Handle GET requests - serve the Test Dialog HTML
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('TestDialog')
    .setTitle('G8N Workflow Test')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle POST requests - process workflow actions
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Check if this is a workflow run request
    if (data.action === 'workflow.run') {
      const result = WorkflowRunner.run(
        data.payload.input,
        data.payload.triggerType || 'webhook',
        data.payload.triggerMeta || {}
      );
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Otherwise use Router for other actions
    const result = Router.dispatch(data);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Ping function for connection testing
 */
function ping() {
  return 'pong';
}
