/* configd.c — remote configuration API (project #8).
 * POST /config with header  X-Config-Token: <token>  writes the body's key=value lines to config.out.
 * Token is compared in constant time (ctEq, mirroring worker.js:265) and read from env NIMBUS_CONFIG_TOKEN
 * (default "changeme" for the sandbox). No mmap/SIGUSR1 machinery — a file write is enough here. localhost :8088. */
#include "common.h"

#define OUTFILE "config.out"

/* Constant-time string equality — same shape as worker.js ctEq. */
static int ct_eq(const char *a, const char *b){
    size_t la = strlen(a), lb = strlen(b);
    if(la != lb) return 0;
    unsigned char r = 0;
    for(size_t i = 0; i < la; i++) r |= (unsigned char)(a[i] ^ b[i]);
    return r == 0;
}

/* Extract a header value (case-insensitive name) into out; returns 1 if found. */
static int header(const char *req, const char *name, char *out, size_t olen){
    const char *p = req;
    size_t nl = strlen(name);
    while((p = strchr(p, '\n')) != NULL){
        p++;
        if(strncasecmp(p, name, nl) == 0 && p[nl] == ':'){
            const char *v = p + nl + 1;
            while(*v == ' ') v++;
            size_t k = 0;
            while(v[k] && v[k] != '\r' && v[k] != '\n' && k < olen - 1){ out[k] = v[k]; k++; }
            out[k] = 0;
            return 1;
        }
    }
    return 0;
}

static void handle(int c, const char *token){
    char buf[8192]; ssize_t n = read(c, buf, sizeof buf - 1);
    if(n <= 0){ close(c); return; }
    buf[n] = 0;
    char method[8], path[256];
    if(sscanf(buf, "%7s %255s", method, path) != 2){ ne_http_reply(c,"400 Bad Request","text/plain","bad\n"); close(c); return; }
    if(strcmp(method, "POST") || strncmp(path, "/config", 7)){ ne_http_reply(c,"404 Not Found","text/plain","POST /config only\n"); close(c); return; }

    char got[256] = "";
    if(!header(buf, "X-Config-Token", got, sizeof got) || !ct_eq(got, token)){
        ne_http_reply(c, "401 Unauthorized", "text/plain", "bad or missing X-Config-Token\n"); close(c); return;
    }
    char *body = strstr(buf, "\r\n\r\n");
    body = body ? body + 4 : NULL;
    if(!body || !*body){ ne_http_reply(c,"400 Bad Request","text/plain","empty config body\n"); close(c); return; }
    FILE *f = fopen(OUTFILE, "w");
    if(!f){ ne_http_reply(c,"500 Internal Server Error","text/plain","write failed\n"); close(c); return; }
    fputs(body, f); fclose(f);
    ne_http_reply(c, "200 OK", "text/plain", "config updated\n");
    close(c);
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8088;
    const char *token = getenv("NIMBUS_CONFIG_TOKEN");
    if(!token || !*token) token = "changeme";
    int s = ne_listen_tcp(port);
    if(s < 0){ perror("listen"); return 1; }
    fprintf(stderr, "configd.c on :%d (token via NIMBUS_CONFIG_TOKEN)\n", port);
    for(;;){ int c = accept(s, NULL, NULL); if(c >= 0) handle(c, token); }
    return 0;
}
