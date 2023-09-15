using UnityEngine;

[RequireComponent(typeof(Camera))]
public class CameraScaler : MonoBehaviour
{
    [SerializeField] protected int targetWidth = 1920;
    [SerializeField] protected int targetHeight = 1080;

    [SerializeField] protected int dynamicMaxWidth = 2560;
    [SerializeField] protected int dynamicMaxHeight = 1440;

    [SerializeField] protected bool useDynamicWidth = false;
    [SerializeField] protected bool useDynamicHeight = false;

    private Camera cam;
    private int lastWidth = 0;
    private int lastHeight = 0;

    private float orthoSize;

    protected void Awake()
    {
        cam = GetComponent<Camera>();
        orthoSize = cam.orthographicSize;
    }

    protected void Update()
    {
        if (Screen.width != lastWidth || Screen.height != lastHeight)
        {
            UpdateCamSize();
            lastWidth = Screen.width;
            lastHeight = Screen.height;
        }
    }

    private void UpdateCamSize()
    {
        float targetAspect;
        float screenAspect = (float)Screen.width / (float)Screen.height;
        float ortoScale = 1f;

        if (useDynamicWidth)
        {
            float minTargetAspect = (float)targetWidth / (float)targetHeight;
            float maxTargetAspect = (float)dynamicMaxWidth / (float)targetHeight;
            targetAspect = Mathf.Clamp(screenAspect, minTargetAspect, maxTargetAspect);
        }
        else
        {
            targetAspect = (float)targetWidth / (float)targetHeight;
        }

        float scaleValue = screenAspect / targetAspect;

        Rect rect = new();
        if (scaleValue < 1f)
        {
            if (useDynamicHeight)
            {
                float minTargetAspect = (float)targetWidth / (float)dynamicMaxHeight;
                if (screenAspect < minTargetAspect)
                {
                    scaleValue = screenAspect / minTargetAspect;
                    ortoScale = minTargetAspect / targetAspect;
                }
                else
                {
                    ortoScale = scaleValue;
                    scaleValue = 1f;
                }
            }

            rect.width = 1;
            rect.height = scaleValue;
            rect.x = 0;
            rect.y = (1 - scaleValue) / 2;
        }
        else
        {
            scaleValue = 1 / scaleValue;
            rect.width = scaleValue;
            rect.height = 1;
            rect.x = (1 - scaleValue) / 2;
            rect.y = 0;
        }

        cam.orthographicSize = orthoSize / ortoScale;
        cam.rect = rect;
    }
}