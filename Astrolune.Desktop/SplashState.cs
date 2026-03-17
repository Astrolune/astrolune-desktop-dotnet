using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace Astrolune.Desktop;

public sealed class SplashState : INotifyPropertyChanged
{
    private string _currentStep = "Initializing";
    private double _progress;
    private string? _warning;
    private string? _error;

    public event PropertyChangedEventHandler? PropertyChanged;

    public string CurrentStep
    {
        get => _currentStep;
        set => SetField(ref _currentStep, value);
    }

    public double Progress
    {
        get => _progress;
        set => SetField(ref _progress, value);
    }

    public string? Warning
    {
        get => _warning;
        set
        {
            if (SetField(ref _warning, value))
            {
                OnPropertyChanged(nameof(HasWarning));
            }
        }
    }

    public string? Error
    {
        get => _error;
        set
        {
            if (SetField(ref _error, value))
            {
                OnPropertyChanged(nameof(HasError));
            }
        }
    }

    public bool HasWarning => !string.IsNullOrWhiteSpace(_warning);

    public bool HasError => !string.IsNullOrWhiteSpace(_error);

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged(string? propertyName)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
