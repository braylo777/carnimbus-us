/* shorty.c — URL shortener & redirector (project #7).
 * POST /shorten  (body: url=<abs-url>)  -> allocates a base62 id, appends "<id> <url>" to shorty.db, returns it.
 * GET  /<id>                            -> 302 Redirect to the stored URL.
 * Flat-file store loaded into memory on start. localhost sandbox on :8087. */
#include "common.h"

#define MAXMAP 4096
#define DBFILE "shorty.db"

struct pair { char id[16]; char url[1024]; };
static struct pair map[MAXMAP];
static int nmap = 0;
static long counter = 100000;   /* keeps ids >= 4 base62 chars */

static void b62(long v, char *out){
    static const char *A = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    char tmp[16]; int i = 0;
    if(v == 0){ out[0] = '0'; out[1] = 0; return; }
    while(v > 0 && i < 15){ tmp[i++] = A[v % 62]; v /= 62; }
    int j = 0; while(i > 0) out[j++] = tmp[--i];
    out[j] = 0;
}

static void load(void){
    FILE *f = fopen(DBFILE, "r");
    if(!f) return;
    while(nmap < MAXMAP && fscanf(f, "%15s %1023s", map[nmap].id, map[nmap].url) == 2){
        counter++; nmap++;
    }
    fclose(f);
}

static const char *find(const char *id){
    for(int i = 0; i < nmap; i++) if(!strcmp(map[i].id, id)) return map[i].url;
    return NULL;
}

/* Pull the last path segment (the id) or the url= form field out of the raw request. */
static void handle(int c){
    char buf[4096]; ssize_t n = read(c, buf, sizeof buf - 1);
    if(n <= 0){ close(c); return; }
    buf[n] = 0;
    char method[8], path[1024];
    if(sscanf(buf, "%7s %1023s", method, path) != 2){ ne_http_reply(c,"400 Bad Request","text/plain","bad\n"); close(c); return; }

    if(!strcmp(method, "POST") && !strncmp(path, "/shorten", 8)){
        char *u = strstr(buf, "url=");
        if(!u){ ne_http_reply(c,"400 Bad Request","text/plain","need url=\n"); close(c); return; }
        u += 4; char url[1024]; int k = 0;
        while(u[k] && u[k] != '&' && u[k] != '\r' && u[k] != '\n' && k < 1023){ url[k] = u[k]; k++; }
        url[k] = 0;
        if(k == 0 || nmap >= MAXMAP){ ne_http_reply(c,"400 Bad Request","text/plain","no\n"); close(c); return; }
        char id[16]; b62(counter++, id);
        strncpy(map[nmap].id, id, sizeof map[nmap].id - 1);
        strncpy(map[nmap].url, url, sizeof map[nmap].url - 1);
        map[nmap].id[15] = 0; map[nmap].url[1023] = 0; nmap++;
        FILE *f = fopen(DBFILE, "a"); if(f){ fprintf(f, "%s %s\n", id, url); fclose(f); }
        char body[128]; snprintf(body, sizeof body, "/%s\n", id);
        ne_http_reply(c, "200 OK", "text/plain", body);
        close(c); return;
    }

    if(!strcmp(method, "GET") && path[0] == '/' && path[1]){
        const char *url = find(path + 1);
        if(url){
            char h[1200];
            int hn = snprintf(h, sizeof h, "HTTP/1.1 302 Found\r\nLocation: %s\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", url);
            if(hn > 0) ne_write_all(c, h, (size_t)hn);
        } else ne_http_reply(c, "404 Not Found", "text/plain", "no such link\n");
        close(c); return;
    }
    ne_http_reply(c, "404 Not Found", "text/plain", "usage: POST /shorten url=... | GET /<id>\n");
    close(c);
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8087;
    load();
    int s = ne_listen_tcp(port);
    if(s < 0){ perror("listen"); return 1; }
    fprintf(stderr, "shorty.c on :%d (%d links loaded)\n", port, nmap);
    for(;;){ int c = accept(s, NULL, NULL); if(c >= 0) handle(c); }
    return 0;
}
