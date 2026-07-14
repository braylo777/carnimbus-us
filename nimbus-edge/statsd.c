/* statsd.c — bandwidth & request tracker (project #9).
 * Ingests stat lines over UDP :8096 (format: "<bytes> <path>\n" sent by a gateway), keeps the last 1000 in a ring
 * buffer, and serves a plaintext dashboard at GET /stats on :8086. select() drives both sockets in one process. */
#include "common.h"
#include <sys/select.h>

#define RING 1000

struct rec { long bytes; char path[128]; };
static struct rec ring[RING];
static int head = 0, count = 0;
static long total_bytes = 0;

static void ingest(const char *line){
    long b = 0; char path[128] = "/";
    if(sscanf(line, "%ld %127s", &b, path) >= 1){
        ring[head].bytes = b;
        strncpy(ring[head].path, path, sizeof ring[head].path - 1);
        ring[head].path[sizeof ring[head].path - 1] = 0;
        head = (head + 1) % RING;
        if(count < RING) count++;
        total_bytes += b;
    }
}

static void serve_stats(int c){
    char body[1024]; int off = 0;
    off += snprintf(body + off, sizeof body - off,
        "nimbus-edge statsd\nrequests tracked: %d (ring cap %d)\ntotal bytes: %ld\n\nlast 5 paths:\n",
        count, RING, total_bytes);
    for(int k = 0; k < 5 && k < count; k++){
        int idx = (head - 1 - k + RING) % RING;
        off += snprintf(body + off, sizeof body - off, "  %ldB  %s\n", ring[idx].bytes, ring[idx].path);
    }
    ne_http_reply(c, "200 OK", "text/plain", body);
}

int main(int argc, char **argv){
    int hport = (argc > 1) ? atoi(argv[1]) : 8086;
    int uport = (argc > 2) ? atoi(argv[2]) : 8096;
    int s = ne_listen_tcp(hport);
    if(s < 0){ perror("listen"); return 1; }
    int u = socket(AF_INET, SOCK_DGRAM, 0);
    struct sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); a.sin_port = htons((unsigned short)uport);
    if(bind(u, (struct sockaddr*)&a, sizeof a) < 0){ perror("udp bind"); return 1; }
    fprintf(stderr, "statsd.c http :%d  udp-ingest :%d\n", hport, uport);
    for(;;){
        fd_set fds; FD_ZERO(&fds); FD_SET(s, &fds); FD_SET(u, &fds);
        int mx = (s > u ? s : u) + 1;
        if(select(mx, &fds, NULL, NULL, NULL) <= 0) continue;
        if(FD_ISSET(u, &fds)){
            char line[256]; ssize_t n = recv(u, line, sizeof line - 1, 0);
            if(n > 0){ line[n] = 0; ingest(line); }
        }
        if(FD_ISSET(s, &fds)){
            int c = accept(s, NULL, NULL);
            if(c >= 0){ char buf[1024]; ssize_t n = read(c, buf, sizeof buf - 1); if(n > 0){ buf[n] = 0; serve_stats(c); } close(c); }
        }
    }
    return 0;
}
