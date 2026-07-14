/* balancer.c — reverse proxy / round-robin load balancer (project #3).
 * Sits on :8081 and forwards each request to one of OUR OWN backends, round-robin with failover.
 * Scoped to our services only (static :8080, the nimbus-local Node gateway :8787) — this is not a scraper.
 * Blind byte relay: it does not inspect or alter payloads. */
#include "common.h"
#include <sys/select.h>

static const int backends[] = { 8080, 8787 };
static const int NBACK = (int)(sizeof backends / sizeof backends[0]);
static int rr = 0;

/* Pump bytes both ways between client and backend until both sides close. */
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
    int back = -1;
    for(int t = 0; t < NBACK && back < 0; t++){
        int port = backends[(rr + t) % NBACK];
        back = ne_dial_local(port);      /* failover: try the next backend if this one is down */
    }
    rr = (rr + 1) % NBACK;
    if(back < 0){ ne_http_reply(c, "502 Bad Gateway", "text/plain", "no backend available\n"); close(c); return; }
    relay(c, back);
    close(back); close(c);
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8081;
    int s = ne_listen_tcp(port);
    if(s < 0){ perror("listen"); return 1; }
    fprintf(stderr, "balancer.c on :%d -> backends 8080,8787 (round-robin, failover)\n", port);
    for(;;){ int c = accept(s, NULL, NULL); if(c >= 0) handle(c); }
    return 0;
}
