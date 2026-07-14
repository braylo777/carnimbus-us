/* monitor.c — uptime monitor / status daemon (project #5).
 * Every 10s, TCP-connect-probes OUR endpoints (portable; avoids raw ICMP which needs root) and records up/down.
 * Serves GET /status on :8085 as a plaintext "all systems go" page. Single process: select() with a 1s timeout
 * drives both the HTTP listener and the periodic probe. */
#include "common.h"
#include <sys/select.h>

static const int targets[] = { 8080, 8081, 8787 };
static const int NT = (int)(sizeof targets / sizeof targets[0]);
static int up[3];
static char last_check[24] = "never";

static void probe(void){
    for(int i = 0; i < NT; i++){
        int fd = ne_dial_local(targets[i]);
        up[i] = (fd >= 0);
        if(fd >= 0) close(fd);
    }
    ne_ts(last_check, sizeof last_check);
}

static void serve_status(int c){
    char body[512]; int off = 0; int all = 1;
    for(int i = 0; i < NT; i++) if(!up[i]) all = 0;
    off += snprintf(body + off, sizeof body - off, "%s\nchecked: %s\n\n",
                    all ? "All systems go." : "DEGRADED.", last_check);
    for(int i = 0; i < NT && off < (int)sizeof body; i++)
        off += snprintf(body + off, sizeof body - off, "  :%d  %s\n", targets[i], up[i] ? "UP" : "DOWN");
    ne_http_reply(c, "200 OK", "text/plain", body);
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8085;
    int s = ne_listen_tcp(port);
    if(s < 0){ perror("listen"); return 1; }
    fprintf(stderr, "monitor.c on :%d — probing 8080,8081,8787 every 10s\n", port);
    probe();
    time_t next = time(NULL) + 10;
    for(;;){
        fd_set fds; FD_ZERO(&fds); FD_SET(s, &fds);
        struct timeval tv = { 1, 0 };
        int r = select(s + 1, &fds, NULL, NULL, &tv);
        if(r > 0 && FD_ISSET(s, &fds)){
            int c = accept(s, NULL, NULL);
            if(c >= 0){
                char buf[1024]; ssize_t n = read(c, buf, sizeof buf - 1);
                if(n > 0){ buf[n] = 0; serve_status(c); }
                close(c);
            }
        }
        if(time(NULL) >= next){ probe(); next = time(NULL) + 10; }
    }
    return 0;
}
