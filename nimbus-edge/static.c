/* static.c — minimal static-file HTTP/1.1 server for nimbus-edge (project #1 of the mini-Cloudflare stack).
 * Serves a fixed docroot (default ../site) over GET only. R&D sandbox — localhost, no TLS (see MASTER-PLAN gate #1).
 * Security-critical primitive of the whole stack: path-traversal defense. realpath() the target and require it to
 * stay under the resolved docroot prefix before opening. No .. escape, no absolute-path escape, no symlink escape. */
#define _DARWIN_C_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <limits.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>

static const char *docroot;          /* resolved absolute docroot */
static char root_real[PATH_MAX];

static const char *ctype(const char *p){
  const char *d = strrchr(p, '.'); if(!d) return "application/octet-stream";
  if(!strcmp(d,".html")) return "text/html; charset=utf-8";
  if(!strcmp(d,".css"))  return "text/css";
  if(!strcmp(d,".js"))   return "text/javascript";
  if(!strcmp(d,".json")) return "application/json";
  if(!strcmp(d,".svg"))  return "image/svg+xml";
  if(!strcmp(d,".png"))  return "image/png";
  if(!strcmp(d,".webp")) return "image/webp";
  if(!strcmp(d,".jpg")||!strcmp(d,".jpeg")) return "image/jpeg";
  if(!strcmp(d,".ico"))  return "image/x-icon";
  return "application/octet-stream";
}

static void send_status(int c, const char *status, const char *msg){
  char h[256];
  int n = snprintf(h, sizeof h,
    "HTTP/1.1 %s\r\nContent-Type: text/plain\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n%s",
    status, strlen(msg), msg);
  if(n > 0) (void)write(c, h, (size_t)n);
}

/* Returns an open fd for a safe path under docroot, or -1 (and sends the error) on any violation. */
static int resolve_open(int c, const char *urlpath, struct stat *st){
  char decoded[PATH_MAX], joined[PATH_MAX], real[PATH_MAX];
  size_t j = 0;
  /* minimal percent-decode; reject NUL and anything that would overflow */
  for(size_t i = 0; urlpath[i] && urlpath[i] != '?' && j < sizeof decoded - 1; i++){
    if(urlpath[i] == '%' && urlpath[i+1] && urlpath[i+2]){
      char hex[3] = { urlpath[i+1], urlpath[i+2], 0 }; int v = (int)strtol(hex, NULL, 16);
      if(v <= 0){ send_status(c,"400 Bad Request","bad escape"); return -1; }
      decoded[j++] = (char)v; i += 2;
    } else decoded[j++] = urlpath[i];
  }
  decoded[j] = 0;
  if(strstr(decoded, "..")){ send_status(c,"403 Forbidden","no"); return -1; }   /* belt: reject .. pre-realpath */
  if(!strcmp(decoded, "/")) strncpy(decoded, "/index.html", sizeof decoded - 1);
  if(snprintf(joined, sizeof joined, "%s%s", docroot, decoded) >= (int)sizeof joined){
    send_status(c,"414 URI Too Long","too long"); return -1; }
  if(!realpath(joined, real)){ send_status(c,"404 Not Found","not found"); return -1; }
  /* suspenders: resolved path MUST stay under the resolved docroot */
  size_t rl = strlen(root_real);
  if(strncmp(real, root_real, rl) != 0 || (real[rl] != '/' && real[rl] != 0)){
    send_status(c,"403 Forbidden","escapes docroot"); return -1; }
  int fd = open(real, O_RDONLY);
  if(fd < 0 || fstat(fd, st) != 0 || !S_ISREG(st->st_mode)){
    if(fd >= 0) close(fd); send_status(c,"404 Not Found","not found"); return -1; }
  return fd;
}

static void handle(int c){
  char buf[8192]; ssize_t n = read(c, buf, sizeof buf - 1);
  if(n <= 0){ close(c); return; }
  buf[n] = 0;
  char method[8], path[4096];
  if(sscanf(buf, "%7s %4095s", method, path) != 2){ send_status(c,"400 Bad Request","malformed"); close(c); return; }
  if(strcmp(method, "GET") != 0){ send_status(c,"405 Method Not Allowed","GET only"); close(c); return; }
  struct stat st; int fd = resolve_open(c, path, &st);
  if(fd < 0){ close(c); return; }
  char hdr[512];
  int hn = snprintf(hdr, sizeof hdr,
    "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %lld\r\nConnection: close\r\n\r\n",
    ctype(path), (long long)st.st_size);
  if(hn > 0) (void)write(c, hdr, (size_t)hn);
  char fb[65536]; ssize_t r;
  while((r = read(fd, fb, sizeof fb)) > 0){ ssize_t w = 0; while(w < r){ ssize_t k = write(c, fb + w, (size_t)(r - w)); if(k <= 0) break; w += k; } }
  close(fd); close(c);
}

int main(int argc, char **argv){
  int port = (argc > 1) ? atoi(argv[1]) : 8080;
  docroot   = (argc > 2) ? argv[2] : "../site";
  if(!realpath(docroot, root_real)){ perror("docroot"); return 1; }
  docroot = root_real;
  int s = socket(AF_INET, SOCK_STREAM, 0); if(s < 0){ perror("socket"); return 1; }
  int one = 1; setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
  struct sockaddr_in a; memset(&a, 0, sizeof a);
  a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); a.sin_port = htons((uint16_t)port);
  if(bind(s, (struct sockaddr*)&a, sizeof a) < 0){ perror("bind"); return 1; }
  if(listen(s, 64) < 0){ perror("listen"); return 1; }
  fprintf(stderr, "static.c serving %s on http://127.0.0.1:%d\n", root_real, port);
  for(;;){ int c = accept(s, NULL, NULL); if(c >= 0) handle(c); }
  return 0;
}
