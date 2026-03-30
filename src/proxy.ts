import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getBasicAuthCredentials,
  isBasicAuthEnabled,
} from "@/lib/auth/basic-auth";

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Estimate Takeoff"',
    },
  });
}

export function proxy(request: NextRequest) {
  if (!isBasicAuthEnabled()) {
    return NextResponse.next();
  }

  const credentials = getBasicAuthCredentials();

  if (!credentials) {
    return new NextResponse("Basic auth is enabled but credentials are missing.", {
      status: 500,
    });
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encoded = authorization.slice("Basic ".length);
  const decoded = atob(encoded);
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return unauthorizedResponse();
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (
    username !== credentials.username ||
    password !== credentials.password
  ) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
