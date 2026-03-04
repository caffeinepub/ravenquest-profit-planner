import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
  error: Error;
  retry?: () => void;
}

export function ErrorDisplay({ error, retry }: ErrorDisplayProps) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Data</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">{error.message}</p>
        {error.message.includes("Rate limit") && (
          <p className="text-sm">
            Please wait a moment before trying again. The API has rate limits to
            prevent overload.
          </p>
        )}
        {retry && (
          <Button onClick={retry} variant="outline" size="sm" className="mt-2">
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
