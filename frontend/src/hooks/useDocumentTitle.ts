// src/hooks/useDocumentTitle.ts
import { useEffect } from "react";

const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};

export default useDocumentTitle;