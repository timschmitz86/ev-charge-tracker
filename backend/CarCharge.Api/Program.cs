using CarCharge.Api.Interfaces;
using CarCharge.Api.Models;
using CarCharge.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddSingleton<ChargingService>();

// Vehicle integration — optional, config-driven
var vehicleConfig = builder.Configuration.GetSection(VehicleIntegrationOptions.SectionName)
    .Get<VehicleIntegrationOptions>() ?? new VehicleIntegrationOptions();
builder.Services.Configure<VehicleIntegrationOptions>(
    builder.Configuration.GetSection(VehicleIntegrationOptions.SectionName));

if (!vehicleConfig.Enabled || string.Equals(vehicleConfig.Provider, "dummy", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IVehicleDataProvider, DummyVehicleProvider>();
}
else if (string.Equals(vehicleConfig.Provider, "skoda_connect", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddHttpClient<IVehicleDataProvider, SkodaConnectVehicleProvider>(client =>
    {
        client.BaseAddress = new Uri(vehicleConfig.SkodaConnectBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(15);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        UseProxy = false
    });
}
else
{
    builder.Services.AddHttpClient<IVehicleDataProvider, RemoteVehicleProvider>(client =>
    {
        client.BaseAddress = new Uri(vehicleConfig.BaseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        UseProxy = false
    });
}
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "v1");
    });

    app.MapScalarApiReference();

}


// Force singleton initialization at startup
app.Services.GetRequiredService<ChargingService>();

app.UseCors();
app.MapControllers();

app.Run();
