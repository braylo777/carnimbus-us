/* common.h — shared helpers for the nimbus-edge daemons. Header-only (static inline) so each daemon stays a
 * single translation unit compiled by the Makefile's pattern rule. Loopback-only listeners in Phase A. */
#ifndef NIMBUS_EDGE_COMMON_H
#define NIMBUS_EDGE_COMMON_H

#define _DARWIN_C_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>

/* Create a loopback TCP listener on `port`, or return -1. SO_REUSEADDR so restarts don't hit TIME_WAIT. */
static inline int ne_listen_tcp(int port){
    int s = socket(AF_INET, SOCK_STREAM, 0);
    if(s < 0) return -1;
    int one = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in a;
    memset(&a, 0, sizeof a);
    a.sin_family = AF_INET;
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);   /* Phase A: never public */
    a.sin_port = htons((unsigned short)port);
    if(bind(s, (struct sockaddr*)&a, sizeof a) < 0){ close(s); return -1; }
    if(listen(s, 64) < 0){ close(s); return -1; }
    return s;
}

/* Dial 127.0.0.1:port, return connected fd or -1. */
static inline int ne_dial_local(int port){
    int s = socket(AF_INET, SOCK_STREAM, 0);
    if(s < 0) return -1;
    struct sockaddr_in a;
    memset(&a, 0, sizeof a);
    a.sin_family = AF_INET;
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    a.sin_port = htons((unsigned short)port);
    if(connect(s, (struct sockaddr*)&a, sizeof a) < 0){ close(s); return -1; }
    return s;
}

/* Write the whole buffer, retrying short writes. Returns 0 on success, -1 on error. */
static inline int ne_write_all(int fd, const char *buf, size_t len){
    size_t off = 0;
    while(off < len){
        ssize_t k = write(fd, buf + off, len - off);
        if(k <= 0){ if(errno == EINTR) continue; return -1; }
        off += (size_t)k;
    }
    return 0;
}

/* Send a tiny plaintext HTTP response with an explicit status line + body. */
static inline void ne_http_reply(int c, const char *status, const char *ctype, const char *body){
    char h[512];
    int n = snprintf(h, sizeof h,
        "HTTP/1.1 %s\r\nContent-Type: %s\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n",
        status, ctype, strlen(body));
    if(n > 0) ne_write_all(c, h, (size_t)n);
    ne_write_all(c, body, strlen(body));
}

/* ISO-8601 UTC timestamp into buf (needs >=21 bytes). */
static inline void ne_ts(char *buf, size_t len){
    time_t t = time(NULL);
    struct tm g;
    gmtime_r(&t, &g);
    strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &g);
}

#endif /* NIMBUS_EDGE_COMMON_H */
