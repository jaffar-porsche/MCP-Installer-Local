import { ClientApproval, CookieClientApprovalStore } from "./consent.js";
import { Request, Response } from "express";
import * as cookie from "cookie";

describe("CookieClientApprovalStore", () => {
  const approvedClientsCookieName = "APPROVED";
  const deniedClientsCookieName = "DENIED";

  const client1Id = "client1";
  const client1RedirectUri = "http://client1.redirect.uri";
  const client2Id = "client2";
  const client2RedirectUri = "http://client2.redirect.uri";
  const client3Id = "client3";
  const client3RedirectUri = "http://client3.redirect.uri";

  const client1CookieValue = JSON.stringify([
    `${client1Id}:${client1RedirectUri}`,
  ]);
  const client1Cookie = cookie.serialize(
    approvedClientsCookieName,
    client1CookieValue,
  );
  const client2CookieValue = JSON.stringify([
    `${client2Id}:${client2RedirectUri}`,
  ]);
  const client2Cookie = cookie.serialize(
    deniedClientsCookieName,
    client2CookieValue,
  );

  const cookieValue = [client1Cookie, client2Cookie].join(";");

  const createMockRequest = (cookie?: string) => {
    return {
      headers: {
        cookie,
      },
    } as unknown as Request;
  };

  test("getClientApproval", () => {
    const store = new CookieClientApprovalStore(
      approvedClientsCookieName,
      deniedClientsCookieName,
      createMockRequest(cookieValue),
    );

    const client1Approval = store.getClientApproval(
      client1Id,
      client1RedirectUri,
    );
    expect(client1Approval).toBe(ClientApproval.APPROVED);

    const client2Approval = store.getClientApproval(
      client2Id,
      client2RedirectUri,
    );
    expect(client2Approval).toBe(ClientApproval.DENIED);

    const client3Approval = store.getClientApproval(
      client3Id,
      client3RedirectUri,
    );
    expect(client3Approval).toBeUndefined();
  });

  test("setClientApproval", () => {
    const store = new CookieClientApprovalStore(
      approvedClientsCookieName,
      deniedClientsCookieName,
      createMockRequest(),
    );
    const mockResponse = {
      cookie: jest.fn(),
    } as unknown as Response;

    store.setClientApproval(
      mockResponse,
      client1Id,
      client1RedirectUri,
      ClientApproval.APPROVED,
    );
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      approvedClientsCookieName,
      client1CookieValue,
      { httpOnly: true, secure: true },
    );

    store.setClientApproval(
      mockResponse,
      client2Id,
      client2RedirectUri,
      ClientApproval.DENIED,
    );
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      deniedClientsCookieName,
      client2CookieValue,
      { httpOnly: true, secure: true },
    );
  });
});
