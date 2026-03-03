// Deno type declarations for Supabase Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Allow HTTP imports for Deno
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export function createClient(url: string, key: string): any;
}
