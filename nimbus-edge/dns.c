/* dns.c — caching DNS resolver (project #2).
 * Listens on UDP :8053 (unprivileged; real port 53 needs root, and 5353 is macOS mDNSResponder/Bonjour),
 * forwards queries to upstream 1.1.1.1:53,
 * and caches whole replies keyed by the query's question section, TTL-aware, in a fixed-size LRU.
 * Standard recursive-forwarder pattern — nothing evasive. */
#include "common.h"
#include <sys/time.h>

#define CACHE_N 256
#define MAXPKT  1500

struct entry {
    unsigned char q[MAXPKT];  int qlen;      /* question bytes = cache key */
    unsigned char r[MAXPKT];  int rlen;      /* full upstream reply (minus its ID) */
    time_t expires;
    unsigned long used;                      /* for LRU eviction */
};
static struct entry cache[CACHE_N];
static unsigned long tick = 0;

/* Question section spans from offset 12 to the end of QNAME + 4 bytes (QTYPE+QCLASS). Returns length or -1. */
static int question_len(const unsigned char *p, int n){
    int i = 12;
    if(n < 12) return -1;
    while(i < n && p[i] != 0){
        if((p[i] & 0xC0) == 0xC0) return -1;   /* no compression in a question */
        i += p[i] + 1;
        if(i >= n) return -1;
    }
    i += 1 + 4;                                /* zero label + QTYPE + QCLASS */
    return (i <= n) ? i - 12 : -1;
}

/* Minimum TTL across answer RRs, or a 60s floor. Best-effort; bounds every access. */
static long min_ttl(const unsigned char *p, int n){
    int i = 12, ancount;
    if(n < 12) return 60;
    ancount = (p[6] << 8) | p[7];
    while(i < n && p[i] != 0){ if((p[i] & 0xC0) == 0xC0){ i += 2; goto q_end; } i += p[i] + 1; }
    i += 1;                                    /* zero label */
q_end:
    i += 4;                                     /* QTYPE + QCLASS */
    long best = -1;
    for(int a = 0; a < ancount && i + 12 <= n; a++){
        if((p[i] & 0xC0) == 0xC0) i += 2; else { while(i < n && p[i] != 0) i += p[i] + 1; i += 1; }
        if(i + 10 > n) break;
        long ttl = ((long)p[i+4] << 24) | ((long)p[i+5] << 16) | ((long)p[i+6] << 8) | (long)p[i+7];
        int rdlen = (p[i+8] << 8) | p[i+9];
        i += 10 + rdlen;
        if(best < 0 || ttl < best) best = ttl;
    }
    if(best < 0) best = 60;
    if(best > 3600) best = 3600;
    return best;
}

static struct entry *lookup(const unsigned char *q, int qlen){
    time_t now = time(NULL);
    for(int i = 0; i < CACHE_N; i++)
        if(cache[i].qlen == qlen && cache[i].expires > now && memcmp(cache[i].q, q, (size_t)qlen) == 0)
            return &cache[i];
    return NULL;
}

static void store(const unsigned char *q, int qlen, const unsigned char *r, int rlen, long ttl){
    int victim = 0;
    for(int i = 0; i < CACHE_N; i++){
        if(cache[i].qlen == 0){ victim = i; break; }
        if(cache[i].used < cache[victim].used) victim = i;   /* LRU */
    }
    memcpy(cache[victim].q, q, (size_t)qlen); cache[victim].qlen = qlen;
    memcpy(cache[victim].r, r, (size_t)rlen); cache[victim].rlen = rlen;
    cache[victim].expires = time(NULL) + ttl;
    cache[victim].used = ++tick;
}

int main(int argc, char **argv){
    int port = (argc > 1) ? atoi(argv[1]) : 8053;
    int s = socket(AF_INET, SOCK_DGRAM, 0);
    if(s < 0){ perror("socket"); return 1; }
    int one = 1; setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); a.sin_port = htons((unsigned short)port);
    if(bind(s, (struct sockaddr*)&a, sizeof a) < 0){ perror("bind"); return 1; }

    struct sockaddr_in up; memset(&up, 0, sizeof up);
    up.sin_family = AF_INET; up.sin_port = htons(53); up.sin_addr.s_addr = inet_addr("1.1.1.1");
    fprintf(stderr, "dns.c on udp/%d -> upstream 1.1.1.1:53 (LRU cache %d)\n", port, CACHE_N);

    for(;;){
        unsigned char pkt[MAXPKT];
        struct sockaddr_in cli; socklen_t cl = sizeof cli;
        ssize_t n = recvfrom(s, pkt, sizeof pkt, 0, (struct sockaddr*)&cli, &cl);
        if(n < 12) continue;
        int qlen = question_len(pkt, (int)n);
        if(qlen < 0) continue;
        unsigned char id0 = pkt[0], id1 = pkt[1];

        struct entry *hit = lookup(pkt + 12, qlen);
        if(hit){
            unsigned char out[MAXPKT];
            memcpy(out, hit->r, (size_t)hit->rlen);
            out[0] = id0; out[1] = id1;                      /* restore this client's transaction ID */
            hit->used = ++tick;
            sendto(s, out, (size_t)hit->rlen, 0, (struct sockaddr*)&cli, cl);
            fprintf(stderr, "  cache HIT\n");
            continue;
        }

        int u = socket(AF_INET, SOCK_DGRAM, 0);
        if(u < 0) continue;
        struct timeval tv = { 3, 0 };
        setsockopt(u, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
        sendto(u, pkt, (size_t)n, 0, (struct sockaddr*)&up, sizeof up);
        unsigned char rep[MAXPKT];
        ssize_t rn = recv(u, rep, sizeof rep, 0);
        close(u);
        if(rn < 12) continue;
        long ttl = min_ttl(rep, (int)rn);
        store(pkt + 12, qlen, rep, (int)rn, ttl);
        sendto(s, rep, (size_t)rn, 0, (struct sockaddr*)&cli, cl);
        fprintf(stderr, "  cache MISS -> upstream (ttl %ld)\n", ttl);
    }
    return 0;
}
