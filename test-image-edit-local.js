const fs = require('fs');
const path = require('path');

async function testImageEdit() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create a simple test image if none exists
  const testImagePath = path.join(__dirname, 'test-image.png');
  
  if (!fs.existsSync(testImagePath)) {
    console.log('⚠️  No test image found. Please add a test-image.png file to test with.');
    console.log('   You can use any PNG, JPG, or WebP image under 50MB');
    process.exit(1);
  }

  console.log('🚀 Testing OpenAI Image Edit API with gpt-image-1');
  console.log('='.repeat(60));

  try {
    const formData = new FormData();
    
    // Read the image file as a blob
    const imageBuffer = fs.readFileSync(testImagePath);
    const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
    
    // Add the image file
    formData.append('image', imageBlob, 'test-image.png');
    
    // Add required parameters for gpt-image-1
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', 'Transform this photo into The Simpsons cartoon style with iconic yellow skin, bold black outlines, flat bright colors, simple rounded features, and the classic Springfield aesthetic while maintaining the person\'s recognizable facial structure and identity');
    formData.append('size', '1024x1024');
    formData.append('n', '1');
    formData.append('output_format', 'png');
    formData.append('background', 'auto');
    formData.append('quality', 'auto');

    console.log('📋 Request parameters:');
    console.log('   Model: gpt-image-1');
    console.log('   Size: 1024x1024');
    console.log('   Output format: png');
    console.log('   Background: auto');
    console.log('   Quality: auto');
    console.log('');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('❌ Error details:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('✅ Success! Response structure:');
    console.log('   Created:', new Date(result.created * 1000).toISOString());
    console.log('   Data length:', result.data?.length || 0);
    console.log('   Usage:', result.usage || 'No usage info');
    
    if (result.data && result.data.length > 0) {
      const imageData = result.data[0];
      console.log('');
      console.log('🖼️  Generated image info:');
      
      if (imageData.b64_json) {
        console.log('   Format: Base64 JSON');
        console.log('   Data length:', imageData.b64_json.length, 'characters');
        
        // Save the image locally
        const outputPath = path.join(__dirname, 'generated-image.png');
        fs.writeFileSync(outputPath, Buffer.from(imageData.b64_json, 'base64'));
        console.log('   ✅ Saved to:', outputPath);
      } else if (imageData.url) {
        console.log('   Format: URL');
        console.log('   URL:', imageData.url);
      }
    }

    console.log('');
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

// Run the test
testImageEdit();