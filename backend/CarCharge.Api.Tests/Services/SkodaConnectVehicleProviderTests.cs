using System.Net;
using System.Net.Http.Headers;
using CarCharge.Api.Models;
using CarCharge.Api.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace CarCharge.Api.Tests.Services;

public class SkodaConnectVehicleProviderTests
{
    private const string ApiKey = "test-key";
    private const string Vin = "TMBJB9NY5RF999999";

    [Fact]
    public async Task GetMileageAsync_ReturnsOdometerAndSendsConfiguredCredentials()
    {
        HttpRequestMessage? capturedRequest = null;
        var handler = new TestHandler(request =>
        {
            capturedRequest = request;
            return JsonResponse("""{"vehicle":{"odometer":{"mileageInKm":12753}},"errors":[]}""");
        });
        var provider = CreateProvider(handler);

        var result = await provider.GetMileageAsync("car1");

        Assert.Equal(12753, result);
        Assert.Equal("/api/v1/vehicles/TMBJB9NY5RF999999", capturedRequest?.RequestUri?.AbsolutePath);
        Assert.Equal("odometer", capturedRequest?.RequestUri?.Query.TrimStart('?').Split('=')[1]);
        Assert.Equal(ApiKey, capturedRequest?.Headers.GetValues("X-API-Key").Single());
    }

    [Fact]
    public async Task GetMileageAsync_ReturnsNullForUnauthorizedResponse()
    {
        var provider = CreateProvider(new TestHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized)));

        var result = await provider.GetMileageAsync("car1");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetMileageAsync_RetriesRateLimitAndReturnsMileage()
    {
        var calls = 0;
        var handler = new TestHandler(_ =>
        {
            calls++;
            if (calls == 1)
            {
                var response = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero);
                return response;
            }

            return JsonResponse("""{"vehicle":{"odometer":{"mileageInKm":42}}}""");
        });
        var provider = CreateProvider(handler);

        var result = await provider.GetMileageAsync("car1");

        Assert.Equal(42, result);
        Assert.Equal(2, calls);
    }

    private static SkodaConnectVehicleProvider CreateProvider(HttpMessageHandler handler) =>
        new(
            new HttpClient(handler) { BaseAddress = new Uri("https://public.api.connect.skoda-auto.cz") },
            Options.Create(new VehicleIntegrationOptions
            {
                SkodaConnectApiKey = ApiKey,
                SkodaConnectVin = Vin
            }),
            LoggerFactory.Create(_ => { }).CreateLogger<SkodaConnectVehicleProvider>());

    private static HttpResponseMessage JsonResponse(string content) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(content, System.Text.Encoding.UTF8, "application/json")
        };

    private sealed class TestHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(handler(request));
    }
}
