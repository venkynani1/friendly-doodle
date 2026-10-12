import { Suspense } from "react";
import ScannerConsole from "./ScannerConsole";

export default function ScannerPage() {
  return (
    <Suspense>
      <ScannerConsole />
    </Suspense>
  );
}
