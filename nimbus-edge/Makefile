# nimbus-edge — the C "mini-Cloudflare" stack. R&D sandbox sibling to ../nimbus-local. NOT the production path.
# Doc said `gcc -ansi`; strict C89 fights POSIX sockets, so c11 + _DARWIN_C_SOURCE, kept warns-clean. Same spirit.
CC      = cc
CFLAGS  = -std=c11 -Wall -Wextra -O2   # _DARWIN_C_SOURCE is set in-source (common.h / static.c)
BINS    = static balancer dns monitor statsd shorty configd tunnel

all: $(BINS)

%: %.c common.h
	$(CC) $(CFLAGS) -o $@ $<

clean:
	rm -f $(BINS)

.PHONY: all clean
