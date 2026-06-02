#include <common>
#include <packing>

uniform bool receiveShadow;
uniform vec3 shadowColor;

#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

varying float vLife;
varying vec3 vColor;
varying vec3 vLightDir;
varying vec3 vViewDir;

uniform float shadowBlurRadius;

#define SHADOW_BLUR_TAPS 12

float shadowRotationNoise( vec2 p ) {
    return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) );
}

float getBlurredShadowMask() {
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        if ( ! receiveShadow ) return 1.0;

        DirectionalLightShadow shadow = directionalLightShadows[ 0 ];
        vec4 baseCoord = vDirectionalShadowCoord[ 0 ];

        vec2 texel = ( 1.0 / shadow.shadowMapSize ) * shadowBlurRadius * baseCoord.w;

        float phi = shadowRotationNoise( gl_FragCoord.xy ) * 6.28318530718;
        float sum = 0.0;

        for ( int i = 0; i < SHADOW_BLUR_TAPS; i++ ) {

            float r = sqrt( ( float( i ) + 0.5 ) / float( SHADOW_BLUR_TAPS ) );
            float theta = float( i ) * 2.39996323 + phi;
            vec2 off = r * vec2( cos( theta ), sin( theta ) );

            vec4 coord = baseCoord;
            coord.xy += off * texel;
            sum += getShadow(
                directionalShadowMap[ 0 ],
                shadow.shadowMapSize,
                shadow.shadowIntensity,
                shadow.shadowBias,
                shadow.shadowRadius,
                coord
            );
        }
        return sum / float( SHADOW_BLUR_TAPS );
    #else
        return 1.0;
    #endif
}

void main() {

    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    uv.y = -uv.y;

    float r2 = dot(uv, uv);

    if (r2 > 1.0) discard;

    vec3 normal = vec3(uv, sqrt(max(0.0, 1.0 - r2)));

    vec3 lightDir = normalize(vLightDir);
    vec3 viewDir = normalize(vViewDir);

    float NdotL = dot(normal, lightDir);
    float diffuse = max(NdotL * 0.5 + 0.5, 0.0);
    diffuse *= diffuse;

    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 48.0);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 1.0);

    float shadowMask = getBlurredShadowMask();
    shadowMask = pow(shadowMask, 3.0);

    vec3 ambient = vColor * 0.5;
    vec3 diffuseTerm = vColor * (0.8 * diffuse);
    vec3 specularTerm = vec3(1.0) * (0.6 * specular);
    vec3 rimTerm = vColor * (0.4 * fresnel);

    vec3 color = ambient + (diffuseTerm + specularTerm + rimTerm) * shadowMask;

    float shadowAmount = 1.0 - shadowMask;
    color = mix(color, shadowColor, shadowAmount );


    gl_FragColor = vec4(color, 1.0);
}
