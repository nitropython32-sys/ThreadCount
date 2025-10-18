import { useEffect, useRef, useState } from 'react';
import './App.css';
import { Routes, Route, useNavigate } from 'react-router-dom';
import MaskViewer from './MaskViewer';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/mask" element={<MaskViewer />} />
    </Routes>
  );
}

function MainApp() {
  const videoRef = useRef(null);
  const snapshotCanvasRef = useRef(null);
  const displayCanvasRef = useRef(null);

  const [uploadStatus, setUploadStatus] = useState("");
  const [snapshot, setSnapshot] = useState(null); // Keep original snapshot for reference if needed
  const [processedImage, setProcessedImage] = useState(null); // State for the new processed image
  const [detections, setDetections] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [currentMaskIndex, setCurrentMaskIndex] = useState(0);
  const navigate = useNavigate();

  // Effect to get cameras and start the initial stream
  useEffect(() => {
    const setupCamera = async () => {
      try {
        // First, get permission by asking for a stream
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Now that we have permission, get the list of devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log("Video devices found:", videoDevices);
        setCameras(videoDevices);

        // Stop the initial stream. We only needed it for permission.
        stream.getTracks().forEach(track => track.stop());

        // Set the second camera as default if available, otherwise the first
        if (videoDevices.length > 1) {
          console.log("Defaulting to second camera:", videoDevices[1].deviceId);
          setSelectedCamera(videoDevices[1].deviceId);
        } else if (videoDevices.length > 0) {
          console.log("Defaulting to first camera:", videoDevices[0].deviceId);
          setSelectedCamera(videoDevices[0].deviceId);
        }

      } catch (err) {
        console.error("Error setting up camera: ", err);
      }
    };
    setupCamera();
  }, []);

  // Effect to switch camera stream when selectedCamera changes
  useEffect(() => {
    if (!selectedCamera) return;

    let stream;
    const getCameraStream = async () => {
      try {
        // Stop any existing stream
        if (videoRef.current && videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }

        // Get new stream, requesting highest possible resolution
        console.log(`Getting stream for device: ${selectedCamera}`);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedCamera },
            width: { ideal: 4096 },
            height: { ideal: 2160 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing the camera: ", err);
      }
    };

    getCameraStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCamera]);

  // Effect to draw the PROCESSED snapshot and segmentation mask
  useEffect(() => {
    if (!processedImage || !displayCanvasRef.current || !detections.length > 0) return;
  
    const canvas = displayCanvasRef.current;
    const context = canvas.getContext('2d');
    const img = new Image();
    img.src = processedImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      context.drawImage(img, 0, 0);
  
      const detection = detections[0];
      if (detection && detection.mask && detection.mask.length > 0) {
        const mask = detection.mask[currentMaskIndex];
        const maskImageData = context.createImageData(img.width, img.height);
  
        for (let y = 0; y < mask.length; y++) {
          for (let x = 0; x < mask[y].length; x++) {
            if (mask[y][x] === false) {
              const index = (y * img.width + x) * 4;
              maskImageData.data[index] = 0;
              maskImageData.data[index + 1] = 255;
              maskImageData.data[index + 2] = 0;
              maskImageData.data[index + 3] = 150;
            }
          }
        }
  
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempContext = tempCanvas.getContext('2d');
        tempContext.putImageData(maskImageData, 0, 0);
        context.drawImage(tempCanvas, 0, 0);
      }
    };
  }, [processedImage, detections, currentMaskIndex]);

  const takeSnapshot = () => {
    if (videoRef.current && snapshotCanvasRef.current) {
      const video = videoRef.current;
      const canvas = snapshotCanvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageDataUrl = canvas.toDataURL('image/png');
      
      setSnapshot(imageDataUrl);
      setProcessedImage(null);
      setUploadStatus("Sending...");
      setDetections([]);
      setCurrentMaskIndex(0);
      console.log("Backend URL:", process.env.REACT_APP_BACKEND_URL);

      fetch("https://192.168.4.88:5000/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      .then(response => response.json())
      .then(data => {
        console.log("Success from backend:", data);
        if (data.status === "success") {
          setDetections(data.detections || []);
          setProcessedImage(data.processed_image);
          setUploadStatus(`Found ${data.detections.length} objects.`);
        } else {
          setUploadStatus(data.message || "Upload failed.");
        }
      })
      .catch(error => {
        console.error("Error:", error);
        setUploadStatus("Upload failed.");
      });
    }
  };

  const handleNextMask = () => {
    if (detections.length > 0 && detections[0].mask) {
      setCurrentMaskIndex((prevIndex) => (prevIndex + 1) % detections[0].mask.length);
    }
  };

  const handlePreviousMask = () => {
    if (detections.length > 0 && detections[0].mask) {
      setCurrentMaskIndex((prevIndex) => (prevIndex - 1 + detections[0].mask.length) % detections[0].mask.length);
    }
  };

  const handleSendMask = () => {
    if (detections.length > 0 && detections[0].mask) {
      const mask = detections[0].mask[currentMaskIndex];
      const canvas = displayCanvasRef.current;
      navigate('/mask', { state: { mask: mask, width: canvas.width, height: canvas.height } });
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Camera Feed</h1>
        <p>Aim camera and click the button to detect objects.</p>
        
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="camera-select" style={{ marginRight: '10px' }}>Choose a camera:</label>
          <select id="camera-select" value={selectedCamera} onChange={e => setSelectedCamera(e.target.value)}>
            {cameras.map(camera => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <video ref={videoRef} autoPlay playsInline style={{ width: "80%", maxWidth: "600px" }} />
        <button onClick={takeSnapshot} style={{ marginTop: '10px' }}>Snap and Detect</button>
        <canvas ref={snapshotCanvasRef} style={{ display: 'none' }} />
        
        {uploadStatus && <p>{uploadStatus}</p>}

        <h2>Result</h2>
        <canvas ref={displayCanvasRef} style={{ backgroundColor: '#282c34', maxWidth: '100%' }} />
        {detections.length > 0 && detections[0].mask && detections[0].mask.length > 1 && (
          <div style={{ marginTop: '10px' }}>
            <button onClick={handlePreviousMask}>Previous Mask</button>
            <span style={{ margin: '0 10px' }}>Mask {currentMaskIndex + 1} of {detections[0].mask.length}</span>
            <button onClick={handleNextMask}>Next Mask</button>
          </div>
        )}
        {detections.length > 0 && detections[0].mask && (
          <div style={{ marginTop: '10px' }}>
            <button onClick={handleSendMask}>Send Mask</button>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;