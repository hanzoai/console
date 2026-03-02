import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useSearchQuery, useSearchChat } from "@/src/features/search/hooks";
import { type SearchMode } from "@/src/features/search/types";
import { Search, MessageSquare, ExternalLink } from "lucide-react";

function SearchResults({ projectId, query, mode }: { projectId: string; query: string; mode: SearchMode }) {
  const { data, isPending, isError, error } = useSearchQuery({
    projectId,
    query,
    mode,
    enabled: !!query,
  });

  if (!query) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Enter a query to search your indexed documents.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-destructive">
        {error?.message ?? "Failed to perform search"}
      </div>
    );
  }

  const results = data?.results ?? [];

  if (results.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No results found for "{query}".
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </p>
      {results.map((result, i) => (
        <Card key={i} className="border-l-4 border-l-primary/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {result.title && <h4 className="mb-1 text-sm font-semibold">{result.title}</h4>}
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {result.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {result.highlights && result.highlights.length > 0 ? result.highlights.join(" ... ") : result.content}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {(result.score * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChatTab({ projectId }: { projectId: string }) {
  const [chatQuery, setChatQuery] = useState("");
  const chatMutation = useSearchChat();

  const handleChat = () => {
    if (!chatQuery.trim()) return;
    chatMutation.mutate({ projectId, query: chatQuery.trim() });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          placeholder="Ask a question about your documents..."
          value={chatQuery}
          onChange={(e) => setChatQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleChat();
          }}
        />
        <Button onClick={handleChat} disabled={chatMutation.isPending || !chatQuery.trim()}>
          <MessageSquare className="mr-2 h-4 w-4" />
          {chatMutation.isPending ? "Thinking..." : "Ask"}
        </Button>
      </div>

      {chatMutation.data && (
        <Card>
          <CardContent className="p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p>{chatMutation.data.response}</p>
            </div>
            {chatMutation.data.sources && chatMutation.data.sources.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {chatMutation.data.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {source.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {chatMutation.isError && (
        <div className="text-sm text-destructive">{chatMutation.error?.message ?? "Failed to get a response"}</div>
      )}

      {!chatMutation.data && !chatMutation.isPending && (
        <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          Ask a question to get an AI-generated answer using your indexed documents.
        </div>
      )}
    </div>
  );
}

export function SearchPlayground({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearchQuery(query.trim());
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">
            <Search className="mr-2 h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Search Documents</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter your search query..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  className="flex-1"
                />
                <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="fulltext">Fulltext</SelectItem>
                    <SelectItem value="vector">Vector</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={!query.trim()}>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>

              <SearchResults projectId={projectId} query={searchQuery} mode={mode} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">RAG Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <ChatTab projectId={projectId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
