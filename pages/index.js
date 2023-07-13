import { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { Buffer } from 'buffer';
import Head from "next/head";
import Image from "next/image";
import uploadFileToBlob, { isStorageConfigured, getBlobsInContainer } from './api/upload/azure-storage-blob';
import imageCompression from 'browser-image-compression';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef();
  const prompts = ["evolve", "mutate", "regress", "change", "transform"];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageURL, setImageURL] = useState('');
  const [timestamp, setTimestamp] = useState(Date.now());
  const [imageNames, setImageNames] = useState(["products-white_A4.jpg", "download%20(1).jpg", "download%20(2).jpg", "download%20(3).jpg", "download%20(4).jpg", "d512.jpg"]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStableDiffusionLoading, setIsStableDiffusionLoading] = useState(false);

  useEffect(() => {
    // Load newestCreation.jpg when the page loads
    setImageURL('https://dxarts200.blob.core.windows.net/evolve-images/First-images/newestCreation.jpg');
    setImageLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create the input object
    const input = {
      image: imageURL, // Use the image URL obtained from stable diffusion
      prompt: prompts[Math.floor(Math.random() * prompts.length)],
      prompt_strength: 0.5,
      num_outputs: 1,
      num_inference_steps: 25,
      guidance_scale: 7.5,  
    };

    // Send the request to the API
    const apiResponse = await fetch("/api/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    let prediction = await apiResponse.json();
    console.log('API Response Body: ', prediction.input);
    if (apiResponse.status !== 201) {
      setError(prediction.detail);
      return;
    }
    setPrediction(prediction);
    setIsLoading(true);

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed"
    ) {
      await sleep(1000);
      const statusResponse = await fetch("/api/predictions/" + prediction.id);
      prediction = await statusResponse.json();
      if (statusResponse.status !== 200) {
        setError(prediction.detail);
        return;
      }

      console.log({ prediction });
      setPrediction(prediction);
    }

    // Assuming `prediction.output[prediction.output.length - 1]` is a URL
    // Fetch the result as a blob
    const resultImageResponse = await fetch(prediction.output[prediction.output.length - 1]);
    const resultBlob = await resultImageResponse.blob();

    let options = {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 512,
      useWebWorker: true,
      maxIteration: 10,
    };

    try {
      // Convert Blob to File
      const file = new File([resultBlob], "newestCreation.jpg", { type: "image/jpeg" });
      const compressedFile = await imageCompression(file, options);

      // Use the uploadFileToBlob function to upload the file to Azure Blob Storage
      await uploadFileToBlob(compressedFile, 'newestCreation.jpg');
      console.log('File uploaded successfully');
    } catch (err) {
      console.error('Error while uploading or compressing file:', err);
    }

    // After successful upload, update the timestamp state variable
    setTimestamp(Date.now());
    setIsLoading(false);
  };

  useEffect(() => {
    // Replace this with actual logic to fetch image names
    setImageNames(["A4–plain-cut-sheet-white-800.png", "d512.jpg", "download%20(1).jpg", "download%20(2).jpg", "download%20(3).jpg", "download%20(4).jpg"]);
  }, []);

  const handleStableDiffusionLoad = () => {
    setIsStableDiffusionLoading(false);
  };

  return (
    <div className="container max-w-2xl mx-auto p-5">
      <Head>
        <title>Replicate + Next.js</title>
      </Head>

      <button className="button" type="submit" onClick={handleSubmit}>
        Change Forever
      </button>
      {isLoading && <div className="loading">Loading stable diffusion result...</div>}

      {error && <div>{error}</div>}

      <h1 className="main-text">The most recent image</h1>
      {imageLoaded && !isStableDiffusionLoading && (
        <div className="image-wrapper mt-5">
          <Image
            src={`${imageURL}?v=${timestamp}`}
            className="current-image"
            alt="output"
            width={512}
            height={512}
            onLoad={handleStableDiffusionLoad}
          />
        </div>
      )}
      <h1 className="main-text">The first 6 images, starting with a blank A4 paper</h1>
      <div className="grid grid-cols-3 gap-4">
        {imageNames.map((name, index) => (
          <Image
            key={index}
            src={`https://dxarts200.blob.core.windows.net/evolve-images/First-images/${name}?v=${Date.now()}`}
            alt={name}
            width={500}
            height={500}
          />
        ))}
      </div>
    </div>
  );
}
