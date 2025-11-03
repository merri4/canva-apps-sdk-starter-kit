import React, { useState } from 'react';
import { Button, Rows, FileInput, Columns, Column, Alert, Text, ProgressBar, TextInput } from "@canva/app-ui-kit";
import { addNativeElement } from "@canva/design";
import { upload } from "@canva/asset";
import * as styles from "styles/components.css";

export const App = () => {
  const lambdaPresignedUrl = 'https://rxb7prjm3hgiozbvv7xfxkvzfi0jvhrm.lambda-url.us-east-1.on.aws/';
  const lambdaFaceSwapUrl = 'https://iv2dkofq7iqhdnkhejvwkizafq0eiejp.lambda-url.us-east-1.on.aws/';
  const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const [selectedFile1, setSelectedFile1] = useState(null);
  const [selectedFile2, setSelectedFile2] = useState(null);
  const [previewUrl1, setPreviewUrl1] = useState("");
  const [previewUrl2, setPreviewUrl2] = useState("");
  const [faceIndex1, setFaceIndex1] = useState("0");
  const [faceIndex2, setFaceIndex2] = useState("0");
  const [downloadUrl1, setDownloadUrl1] = useState("");
  const [downloadUrl2, setDownloadUrl2] = useState("");
  const [workProgress, setWorkProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error1, setError1] = useState("");
  const [error2, setError2] = useState("");
  const [exceedError, setExceedError] = useState(false)

  const handleFile = (event, setSelectedFile, setPreviewUrl, setError) => {
    if (event.length > 0) {
      const file = event[0];

      if (allowedFileTypes.includes(file.type)) {
        setSelectedFile(file);

        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);

        setError(""); // 에러 메시지 초기화
      } else {
        setSelectedFile(null);
        setError("Only JPG, JPEG, and PNG files are allowed.");
      }
    }
  };

  const handleFileChange1 = (event) => {
    setDownloadUrl1("");
    handleFile(event, setSelectedFile1, setPreviewUrl1, setError1);
  };

  const handleFileChange2 = (event) => {
    setDownloadUrl2("");
    handleFile(event, setSelectedFile2, setPreviewUrl2, setError2);
  };

  const getPresignedUploadUrl = async (selectedFile) => {
    const fileName = selectedFile.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();

    const url = new URL(lambdaPresignedUrl);
    const params = new URLSearchParams();
    params.append('method', 'PUT');
    params.append('fileType', selectedFile.type);
    params.append('fileExt', fileExtension);
    url.search = params.toString();

    const response = await fetch(url.toString());
    const data = await response.json();
    return data;
  };

  const getPresignedDownloadUrl = async (imageKey) => {
    const url = new URL(lambdaPresignedUrl);
    const params = new URLSearchParams();
    params.append('method', 'GET');
    params.append('key', imageKey);
    url.search = params.toString();

    const response = await fetch(url.toString());
    const data = await response.json();
    return data.downloadUrl;
  };

  const onClick = async () => {
    try {
      setLoading(true);
      setWorkProgress(0)
      let url1 = downloadUrl1;
      let url2 = downloadUrl2;
      if(!exceedError || !downloadUrl1 || !downloadUrl2){
        url1 = await imageToS3Url(selectedFile1, setError1);
        setDownloadUrl1(url1);
        setWorkProgress(40);
        url2 = await imageToS3Url(selectedFile2, setError2);
        setDownloadUrl2(url2);
      }
      setWorkProgress(80);
      if (url1 && url2) {
        await faceSwap(url1, url2);
      }else if (!url1){
        setError1('Upload fail')
        setWorkProgress(0)
      }else if (!url2){
        setError2('Upload fail')
        setWorkProgress(0)
      }
    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  const faceSwap= async (faceImage, targetImage) => {
    setExceedError(false);
    const data = {
      source_image: faceImage,
      target_image: targetImage,
      source_face_index: faceIndex1.split(','),
      face_index: faceIndex2.split(',')
    };

    fetch(lambdaFaceSwapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
      .then(response => response.json())
      .then(data => {
        if (data) {
          if (!data.image) {
            if (data.Reason == "ReservedFunctionConcurrentInvocationLimitExceeded") {
              setExceedError(true);
            } else {
              console.log(data)
            }
          } else {
            addImage(data.image);
            setWorkProgress(100);
          }
        }
      })
      .catch((error) => {
        console.error('Error:', error);
      }).finally(()=>{
        setLoading(false);
    });
  }

  const addImage = async (base64string) => {
    const base64ImageResponse = `data:image/jpeg;base64,${base64string}`;
    const result = await upload({
      type: "image",  // 이 부분이 누락되어 있었습니다
      mimeType: "image/jpeg",
      url: base64ImageResponse,
      thumbnailUrl: base64ImageResponse,
      aiDisclosure: "none"  // AI 사용 여부 명시 (필수)
    });

    await addNativeElement({
      type: "image",
      ref: result.ref,
      altText: { 
        text: "Face swapped image",
        decorative: false
      }
    });
  }

  const imageToS3Url = async (selectedFile, setError) => {
    if (selectedFile) {
      const data = await getPresignedUploadUrl(selectedFile);
      const fileKey = data.fileKey;
      const uploadUrl = data.uploadUrl;
      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': selectedFile.type,
          },
          body: selectedFile,
        });

        if (response.ok) {
          console.log('File uploaded successfully');

          const downloadUrl = await getPresignedDownloadUrl(fileKey);
          return downloadUrl;
        } else {
          setError('File upload failed');
        }
      } catch (error) {
        setError(error)
        console.error('An error occurred during file upload', error);
      }
    } else {
      setError('No file selected');
    }
    return null;
  }

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Columns spacing="1u">
          <Column>
            <Text>
              Face Image
            </Text>
            <FileInput
              onDropAcceptedFiles={handleFileChange1}
              multiple
              accept={allowedFileTypes}
              stretchButton
            />
            {previewUrl1 && <img src={previewUrl1} alt="Preview" style={{ maxWidth: '100%', height: 'auto' }} />}
            {error1 && <p style={{ color: 'red' }}>{error1}</p>}
          </Column>
          <Column>
            <Text>
              Target Image
            </Text>
            <FileInput
              onDropAcceptedFiles={handleFileChange2}
              multiple
              accept={allowedFileTypes}
              stretchButton
            />
            {previewUrl2 && <img src={previewUrl2} alt="Preview" style={{ maxWidth: '100%', height: 'auto' }} />}
            {error2 && <p style={{ color: 'red' }}>{error2}</p>}
          </Column>
        </Columns>

        {exceedError && <Alert tone="warn">Another task is being processed.<br />Please try again later</Alert>}

        <Button variant="primary" onClick={onClick} stretch loading={loading}>
          Face Swap
        </Button>
        {loading &&
          <ProgressBar
            size="medium"
            value={workProgress}
          />
        }

        <Text size="large" alignment="start" tone="secondary">
          # Face index matching
        </Text>
        <Text size="small" alignment="start" tone="tertiary">
          separated by commas
          ex) 0  or  0,1  or 1,0,2   ...
        </Text>
        <Columns spacing="1u">
          <Column width="1/2">
            <Text size="medium" alignment="start">
              Face Image Index
            </Text>
          </Column>
          <Column width="1/2">
            <TextInput
              value={faceIndex1}
              onChange={(event) => setFaceIndex1(event)} />
          </Column>
        </Columns>
        <Columns spacing="1u">
          <Column width="1/2">
            <Text size="medium" alignment="start">
              Target Image Index
            </Text>
          </Column>
          <Column width="1/2">
            <TextInput
              value={faceIndex2}
              onChange={(event) => setFaceIndex2(event)} />
          </Column>
        </Columns>
        <Text size="small" alignment="start" tone="tertiary">
          eg. `0 -&gt; 1` means applying the first face from the source image to the second face in the target image.<br/><br/>
          eg. `0,1 -&gt; 1,0` means swapping the first and second faces from the source image with the second and first faces in the target image, respectively.
        </Text>
      </Rows>
    </div>
  );
};
  
