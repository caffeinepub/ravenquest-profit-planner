import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEndpoint, useSwaggerDoc } from "@/hooks/useQueries";
import { Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";

export function ApiExplorer() {
  const { data: swagger, isLoading, error } = useSwaggerDoc();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const endpoints = useMemo(() => {
    if (!swagger?.paths) return [];

    return Object.entries(swagger.paths).map(([path, methods]) => {
      const method = methods.get ? "GET" : methods.post ? "POST" : "UNKNOWN";
      const info = methods.get || methods.post;
      const category = info?.tags?.[0] || "Other";
      const description = info?.summary || info?.description || "";

      return {
        path,
        method,
        category,
        description,
      };
    });
  }, [swagger]);

  const categories = useMemo(() => {
    const cats = new Set(endpoints.map((e) => e.category));
    return Array.from(cats).sort();
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(
      (e) =>
        e.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [endpoints, searchTerm]);

  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, typeof endpoints> = {};
    for (const e of filteredEndpoints) {
      if (!groups[e.category]) {
        groups[e.category] = [];
      }
      groups[e.category].push(e);
    }
    return groups;
  }, [filteredEndpoints]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error as Error} />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Explorer</h1>
        <p className="text-muted-foreground">
          Browse and test all available Ravendawn API endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sidebar: Endpoint List */}
        <aside className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints</CardTitle>
              <CardDescription>
                {filteredEndpoints.length} available
              </CardDescription>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {categories.map((category) => (
                  <div key={category} className="mb-4">
                    <h3 className="px-4 py-2 text-sm font-semibold">
                      {category}
                    </h3>
                    <div className="space-y-1 px-2">
                      {groupedEndpoints[category]?.map((endpoint) => (
                        <Button
                          key={endpoint.path}
                          variant={
                            selectedPath === endpoint.path
                              ? "secondary"
                              : "ghost"
                          }
                          className="w-full justify-start text-left"
                          onClick={() => setSelectedPath(endpoint.path)}
                        >
                          <Badge variant="outline" className="mr-2 text-xs">
                            {endpoint.method}
                          </Badge>
                          <span className="truncate text-xs">
                            {endpoint.path}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        {/* Main Panel: Endpoint Details */}
        <main className="lg:col-span-8">
          {selectedPath ? (
            <EndpointDetails path={selectedPath} />
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center">
                <p className="text-muted-foreground">
                  Select an endpoint to view details
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function EndpointDetails({ path }: { path: string }) {
  const { data, isLoading, error, refetch } = useEndpoint(path, true);

  const tableData = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.slice(0, 100); // Limit to 100 rows
    }
    return [data];
  }, [data]);

  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    const firstItem = tableData[0] as Record<string, unknown>;
    return Object.keys(firstItem);
  }, [tableData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge>GET</Badge>
          <code className="text-sm">{path}</code>
        </CardTitle>
        <CardDescription>
          <Button onClick={() => refetch()} size="sm" variant="outline">
            Refresh
          </Button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <ErrorDisplay error={error as Error} retry={refetch} />
        ) : (
          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="json">Raw JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: table rows have no stable id
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell key={col} className="max-w-xs truncate">
                            {JSON.stringify(
                              (row as Record<string, unknown>)[col],
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <p className="mt-2 text-sm text-muted-foreground">
                Showing {tableData.length} rows
                {Array.isArray(data) &&
                  data.length > 100 &&
                  ` (limited from ${data.length})`}
              </p>
            </TabsContent>
            <TabsContent value="json">
              <ScrollArea className="h-[500px]">
                <pre className="rounded bg-muted p-4 text-xs">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
