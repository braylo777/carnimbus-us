/* tunnel.c — CONNECT tunneler (project #4).
 * Adds the HTTP CONNECT method: on "CONNECT host:port", dials the target, replies 200, then blindly relays raw
 * bytes both ways until EOF. IMPORTANT: this does NOT decrypt or inspect TLS — it is a byte pipe. The transcript's
 * "hashing to render an HTTPS site" is a misconception; a CONNECT proxy never sees plaintext. For OUR own use.
 * localhost sandbox on :8089. */
#include "common.h"
#include <sys/select.h>

static int dial(const char *host, const char *port){
    struct addrinfo hints, *res, *rp;
    memset(&hints, 0, sizeof hints);
    hints.ai_family = AF_INET; hints.ai_socktype = SOCK_STREAM;
    if(getaddrinfo(host, port, &hints, &res) != 0) return -1;
    int fd = -1;
    for(rp = res; rp; rp = rp->ai_next){
        fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
        if(fd < 0) continue;
        if(connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) break;
        close(fd); fd = -1;
    }
    freeaddrinfo(res);
    return fd;
}

static void relay(int a, int b){
    char buf[65536];
    for(;;){
        fd_set fds; FD_ZERO(&fds); FD_SET(a, &fds); FD_SET(b, &fds);
        int mx = (a > b ? a : b) + 1;
        if(select(mx, &fds, NULL, NULL, NULL) <= 0) break;
        if(FD_ISSET(a, &fds)){ ssize_t n = read(a, buf, sizeof buf); if(n <= 0) break; if(ne_write_all(b, buf, (size_t)n)) break; }
        if(FD_ISSET(b, &fds)){ ssize_t n = read(b, buf, sizeof buf); if(n <= 0) break; if(ne_write_all(a, buf, (size_t)n)) break; }
    }
}

static void handle(int c){
    char buf[2048]; ssize_t n = read(c, buf, sizeof buf - 1);
    if(n <= 0){ close(c); return; }
    buf[n] = 0;
    char method[16], target[512];
    if(sscanf(buf, "%15s %511s", method, target) != 2 || strcmp(method, "CONNECT") != 0){
        ne_http_reply(c, "405 Method Not Allowed", "text/plain", "CONNECT only\n"); close(c); return;
    }
    char host[256], port[16] = "443";
    char *colon = strrchr(target, ':');
    if(colon){ *colon = 0; strncpy(host, target, sizeof host - 1); host[sizeof host - 1] = 0;
               strncpy(port, colon + 1, sizeof port - 1); port[sizeof port - 1] = 0; }
    else { strncpy(host, target, sizeof host - 1); host[sizeof host - 1] = 0; }

    int up = dial(host, port);
    if(up < 0){ ne_http_reply(c, "502 Bad Gateway", "text/plain", "connect failed\n"); close(c); return; }
    const char *ok = "HTTP/1.1 200 Connection Established\r\n\r\n";
    ne_write_all(c, ok, strlen(ok));
    /* Forward any bytes the client pipelined after the CONNECT header (a strict client waits for 200 first, but a
     * correct proxy must not drop trailing bytes). Find the header terminator in the initial read and relay the rest. */
    char *rest = strstr(buf, "\r\n\r\n");
    if(rest){ rest += 4; size_t rlen = (size_t)(buf + n - rest); if(rlen > 0) ne_write_all(up, rest, rlen); }
    relay(c, up);
    close(up); close(c);
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8089;
    int s = ne_listen_tcp(port);
    if(s < 0){ perror("listen"); return 1; }
    fprintf(stderr, "tunnel.c on :%d (CONNECT relay; does not decrypt TLS)\n", port);
    for(;;){ int c = accept(s, NULL, NULL); if(c >= 0) handle(c); }
    return 0;
}
