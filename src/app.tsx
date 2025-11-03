import React, { useState } from 'react';
import { Button, Rows, FileInput, Text } from "@canva/app-ui-kit";
import * as styles from "styles/components.css";

export const App = () => {
  // Lambda Presigned URL을 가져오는 함수 URL
  const lambdaPresignedUrl = "https://rxb7prjm3hgiozbvv7xfxkvzfi0jvhrm.lambda-url.us-east-1.on.aws/";
  
  // 허용할 파일 타입
  const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  // 상태(State) 변수 정의
  const [selectedFile, setSelectedFile] = useState(null); // 사용자가 선택한 파일
  const [previewUrl, setPreviewUrl] = useState("");       // 이미지 미리보기 URL
  const [error, setError] = useState("");                 // 에러 메시지
  const [loading, setLoading] = useState(false);          // 로딩 상태 (API 호출 중)
  const [apiResponse, setApiResponse] = useState("");     // API 호출 결과 저장

  /**
   * 사용자가 파일을 선택했을 때 호출되는 함수
   */
  const handleFileChange = (event) => {
    // 새로운 파일 선택 시, 이전 상태 초기화
    setSelectedFile(null);
    setPreviewUrl("");
    setError("");
    setApiResponse("");

    if (event.length > 0) {
      const file = event[0];

      // 파일 타입 검증
      if (allowedFileTypes.includes(file.type)) {
        setSelectedFile(file);

        // FileReader를 사용하여 이미지 미리보기 생성
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setError("JPG, JPEG, PNG 파일만 선택할 수 있습니다.");
      }
    }
  };

  /**
   * '업로드' 버튼 클릭 시 호출되는 함수
   */
  const handleUpload = async () => {
    if (!selectedFile) {
      setError("먼저 이미지를 선택해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setApiResponse("");

    try {
      // Lambda URL에 쿼리 파라미터를 추가하여 완전한 URL 생성
      const fileName = selectedFile.name;
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      const url = new URL(lambdaPresignedUrl);
      const params = new URLSearchParams();
      params.append('method', 'PUT');
      params.append('fileType', selectedFile.type);
      params.append('fileExt', fileExtension);
      url.search = params.toString();

      // fetch API를 사용하여 Lambda 함수 호출
      const response = await fetch(url.toString());
      if (!response.ok) {
        // HTTP 응답이 실패 상태일 경우 에러 발생
        throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      // 성공적으로 받아온 데이터를 보기 좋게 문자열로 변환하여 상태에 저장
      setApiResponse(JSON.stringify(data, null, 2));

    } catch (e) {
      console.error(e);
      setError(`오류가 발생했습니다: ${e.message}`);
    } finally {
      // API 호출이 성공하든 실패하든 로딩 상태 종료
      setLoading(false);
    }
  };

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Text>
          업로드할 이미지 선택
        </Text>
        <FileInput
          onDropAcceptedFiles={handleFileChange}
          accept={allowedFileTypes}
          stretchButton
        />

        {/* 이미지 미리보기 */}
        {previewUrl && <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', height: 'auto', marginTop: '10px' }} />}
        
        {/* 에러 메시지 표시 (p 태그 대신 Text 컴포넌트 사용) */}
        {error && <Text tone="negative">{error}</Text>}

        <Button 
          variant="primary" 
          onClick={handleUpload} 
          stretch 
          loading={loading}
          // 파일이 선택되지 않았으면 버튼 비활성화
          disabled={!selectedFile}
        >
          업로드
        </Button>

        {/* API 응답 결과 표시 */}
        {apiResponse && (
          <Rows spacing="1u">
            <Text>API 응답 결과:</Text>
            <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {apiResponse}
            </pre>
          </Rows>
        )}
      </Rows>
    </div>
  );
};

